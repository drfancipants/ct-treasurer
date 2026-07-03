import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { syncRosterContributorLinks } from '@/lib/roster-links'

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
    last_name: z.string(),
    email: z.string().email().optional(),
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
  const amount = parseFloat(donation.amount)

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
    let contributor = donation.email
      ? await prisma.contributor.findFirst({
          where: { email: { equals: donation.email, mode: 'insensitive' } },
        })
      : null

    if (!contributor) {
      contributor = await prisma.contributor.create({
        data: {
          firstName: donation.first_name,
          lastName: donation.last_name,
          email: donation.email,
          address1: donation.billing_address?.street ?? '',
          address2: donation.billing_address?.street_2,
          city: donation.billing_address?.city ?? '',
          state: donation.billing_address?.state ?? 'CT',
          zip: donation.billing_address?.zip ?? '',
          employer: donation.employer,
          occupation: donation.occupation,
        },
      })
    }

    // Upsert contribution — idempotent by anedotId
    await prisma.contribution.upsert({
      where: { anedotId: donation.uid },
      create: {
        committeeId: committee.id,
        contributorId: contributor.id,
        amount,
        date: new Date(donation.created_at),
        method: 'CREDIT_CARD',
        source: 'ANEDOT',
        anedotId: donation.uid,
        isItemized: amount >= 50,
        memo: donation.note,
      },
      update: {},
    })

    // The donor may be a roster member — link them up
    await syncRosterContributorLinks(committee.id)

    console.log(`[anedot-webhook] Saved $${amount} from ${donation.first_name} ${donation.last_name} (${donation.uid})`)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[anedot-webhook] Database error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
