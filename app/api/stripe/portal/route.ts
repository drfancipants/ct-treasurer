import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { committeeId } = await req.json()
  if (!committeeId) return NextResponse.json({ error: 'committeeId required' }, { status: 400 })

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId, role: { in: ['TREASURER', 'ASSISTANT_TREASURER'] } },
    include: { committee: true },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { stripeCustomerId } = membership.committee
  if (!stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/app/${membership.committee.slug}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
