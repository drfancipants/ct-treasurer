import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { syncRosterContributorLinks } from '@/lib/roster-links'
import { mapWebhookDonation } from '@/lib/anedot-webhook'

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.ANEDOT_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

const anedotDonationSchema = z.object({
  event: z.string(),
  donation: z.object({
    uid: z.string(),
    amount: z.string(),
    created_at: z.string(),
    first_name: z.string(),
    middle_initial: z.string().optional(),
    last_name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    employer: z.string().optional(),
    occupation: z.string().optional(),
    billing_address: z
      .object({
        street: z.string(),
        street_2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
      })
      .optional(),
    payment_method: z.string().optional(),
    note: z.string().optional(),
    // Processor detail — shapes vary by payload version
    fee: z.string().optional(),
    net_amount: z.string().optional(),
    card_type: z.string().optional(),
    card_last4: z.string().optional(),
    card: z
      .object({ brand: z.string().optional(), last_four: z.string().optional(), last4: z.string().optional() })
      .optional(),
    recurring: z.union([z.boolean(), z.string()]).optional(),
    commitment_uid: z.string().optional(),
    campaign: z.union([z.string(), z.object({ name: z.string().optional() })]).optional(),
    action_page: z.union([z.string(), z.object({ name: z.string().optional() })]).optional(),
    // Account-specific custom questions (CT compliance fields)
    custom_field_responses: z
      .array(
        z.object({
          name: z.string().optional(),
          label: z.string().optional(),
          question: z.string().optional(),
          response: z.string().optional(),
          value: z.string().optional(),
          answer: z.string().optional(),
        })
      )
      .optional(),
    custom_fields: z.record(z.string(), z.string()).optional(),
  }),
  account: z.object({ uid: z.string() }).optional(),
})

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-anedot-signature') ?? ''
  if (!verifySignature(rawBody, signature)) {
    console.warn('[anedot-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: z.infer<typeof anedotDonationSchema>
  try {
    payload = anedotDonationSchema.parse(JSON.parse(rawBody))
  } catch (err) {
    console.error('[anedot-webhook] Parse error', err)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (payload.event !== 'donation.created' && payload.event !== 'donation.completed') {
    return NextResponse.json({ skipped: true })
  }

  const { donation } = payload
  const mapped = mapWebhookDonation(donation)
  const { amount } = mapped

  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  // Route to committee via Anedot account UID
  const committee = payload.account?.uid
    ? await prisma.committee.findFirst({ where: { anedotAccountId: payload.account.uid } })
    : null

  if (!committee) {
    console.warn('[anedot-webhook] No committee for account UID', payload.account?.uid)
    return NextResponse.json({ error: 'Committee not found' }, { status: 404 })
  }

  try {
    // Find or create contributor (match by email, case-insensitive; fall back to create)
    let contributor = mapped.contributor.email
      ? await prisma.contributor.findFirst({
          where: { email: { equals: mapped.contributor.email, mode: 'insensitive' } },
        })
      : null

    if (!contributor) {
      contributor = await prisma.contributor.create({ data: mapped.contributor })
    } else {
      // Backfill missing fields (fill-when-empty; never overwrite) — earlier
      // webhook deliveries may have lacked employer/occupation answers
      const m = mapped.contributor
      const patch: Record<string, string> = {}
      if (!contributor.employer && m.employer) patch.employer = m.employer
      if (!contributor.occupation && m.occupation) patch.occupation = m.occupation
      if (!contributor.phone && m.phone) patch.phone = m.phone
      if (!contributor.middleInitial && m.middleInitial) patch.middleInitial = m.middleInitial
      if (!contributor.address1 && m.address1) patch.address1 = m.address1
      if (!contributor.city && m.city) patch.city = m.city
      if (!contributor.zip && m.zip) patch.zip = m.zip
      if (Object.keys(patch).length > 0) {
        await prisma.contributor.update({ where: { id: contributor.id }, data: patch })
      }
    }

    // Upsert contribution — idempotent by anedotId
    await prisma.contribution.upsert({
      where: { anedotId: donation.uid },
      create: {
        committeeId: committee.id,
        contributorId: contributor.id,
        amount,
        source: 'ANEDOT',
        anedotId: donation.uid,
        isItemized: amount >= 50,
        ...mapped.contribution,
      },
      update: {},
    })

    // The donor may be a roster member — link them up
    await syncRosterContributorLinks(committee.id)

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[anedot-webhook] Database error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
