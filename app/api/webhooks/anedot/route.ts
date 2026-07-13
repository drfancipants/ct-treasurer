import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { syncRosterContributorLinks } from '@/lib/roster-links'
import { anedotPayloadSchema, mapWebhookDonation } from '@/lib/anedot-webhook'

// Anedot signs the raw body with the webhook's secret token (HMAC-SHA256 hex)
// and sends the digest in the X-Request-Signature header
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.ANEDOT_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-request-signature') ?? ''
  if (!verifySignature(rawBody, signature)) {
    console.warn('[anedot-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Skip events we don't ingest before strict validation — refund/commitment
  // payloads have different shapes, and Anedot disables a webhook after
  // enough failed deliveries, so they must get a 200, not a 400
  const event = (body as { event?: unknown } | null)?.event
  if (event !== 'donation_completed') {
    return NextResponse.json({ skipped: true })
  }

  // Anedot's docs nest the donation fields under `payload`, but real
  // deliveries have arrived with them flat beside `event` — accept both
  const record = body as Record<string, unknown>
  const nested = record.payload
  const { event: _event, ...flat } = record
  const candidate = nested && typeof nested === 'object' ? nested : flat

  const parsed = anedotPayloadSchema.safeParse(candidate)
  if (!parsed.success) {
    // Log key names only — donor details must stay out of the logs
    console.error('[anedot-webhook] Parse error', {
      bodyKeys: Object.keys(record),
      candidateKeys: Object.keys(candidate as Record<string, unknown>),
      issues: parsed.error.flatten().fieldErrors,
    })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const payload = parsed.data

  const mapped = mapWebhookDonation(payload)
  const { amount } = mapped

  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  // Route to committee via Anedot account UID
  const committee = await prisma.committee.findFirst({
    where: { anedotAccountId: payload.account_uid },
  })

  if (!committee) {
    console.warn('[anedot-webhook] No committee for account UID', payload.account_uid)
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
      where: { anedotId: payload.donation.id },
      create: {
        committeeId: committee.id,
        contributorId: contributor.id,
        amount,
        source: 'ANEDOT',
        anedotId: payload.donation.id,
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
