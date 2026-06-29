import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionStatus } from '@prisma/client'
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import type Stripe from 'stripe'

function toSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing':            return SubscriptionStatus.trialing
    case 'active':              return SubscriptionStatus.active
    case 'past_due':            return SubscriptionStatus.past_due
    case 'canceled':            return SubscriptionStatus.canceled
    case 'unpaid':              return SubscriptionStatus.past_due
    case 'incomplete':          return SubscriptionStatus.past_due
    case 'incomplete_expired':  return SubscriptionStatus.canceled
    case 'paused':              return SubscriptionStatus.active
    default:                    return SubscriptionStatus.active
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const committeeId = typeof session.metadata?.committeeId === 'string'
          ? session.metadata.committeeId
          : null
        if (!committeeId) break

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        await prisma.committee.update({
          where: { id: committeeId },
          data: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: toSubscriptionStatus(subscription.status),
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const committeeId = subscription.metadata?.committeeId
        if (!committeeId) {
          // Fall back to lookup by stripeSubscriptionId
          await prisma.committee.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              subscriptionStatus: toSubscriptionStatus(subscription.status),
              trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
            },
          })
          break
        }
        await prisma.committee.update({
          where: { id: committeeId },
          data: {
            subscriptionStatus: toSubscriptionStatus(subscription.status),
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
          },
        })
        break
      }

      default:
        // Unhandled event type — ignore
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
