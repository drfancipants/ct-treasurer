import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'
import { FINANCE_ROLES } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { committeeId } = await req.json()
  if (!committeeId) return NextResponse.json({ error: 'committeeId required' }, { status: 400 })

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId, role: { in: FINANCE_ROLES } },
    include: { committee: true },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const committee = membership.committee
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Reuse existing Stripe customer or create a new one
  let customerId = committee.stripeCustomerId ?? undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: committee.name,
      metadata: { committeeId: committee.id },
    })
    customerId = customer.id
    await prisma.committee.update({
      where: { id: committee.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    metadata: { committeeId: committee.id },
    subscription_data: {
      trial_period_days: 14,
      metadata: { committeeId: committee.id },
    },
    success_url: `${appUrl}/app/${committee.slug}/settings?billing=success`,
    cancel_url: `${appUrl}/app/${committee.slug}/settings?billing=canceled`,
  })

  return NextResponse.json({ url: session.url })
}
