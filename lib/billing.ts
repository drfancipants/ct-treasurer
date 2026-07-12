import { SubscriptionStatus } from '@prisma/client'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

/**
 * Map a Stripe subscription status onto our enum. Fails closed: unknown or
 * non-paying statuses (`paused`, and anything Stripe adds later) become
 * `past_due` rather than granting access.
 */
export function toSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'trialing':            return SubscriptionStatus.trialing
    case 'active':              return SubscriptionStatus.active
    case 'past_due':            return SubscriptionStatus.past_due
    case 'canceled':            return SubscriptionStatus.canceled
    case 'unpaid':              return SubscriptionStatus.past_due
    case 'incomplete':          return SubscriptionStatus.past_due
    case 'incomplete_expired':  return SubscriptionStatus.canceled
    // 'paused' means the trial ended without a payment method — not paying
    case 'paused':              return SubscriptionStatus.past_due
    // Fail closed on unknown/future Stripe statuses rather than granting access
    default:                    return SubscriptionStatus.past_due
  }
}

/**
 * Persist a completed subscription Checkout session onto its committee. Shared
 * by the Stripe webhook and the checkout-return page so the two paths can never
 * drift; it is idempotent, so a webhook and a return-page call for the same
 * session simply write the same values. Returns the committeeId it updated, or
 * null if the session isn't an applicable subscription checkout.
 */
export async function applyCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
  if (session.mode !== 'subscription') return null

  const committeeId = typeof session.metadata?.committeeId === 'string'
    ? session.metadata.committeeId
    : null
  if (!committeeId || !session.subscription) return null

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  // updateMany (not update) so an event whose committeeId no longer exists —
  // a deleted committee, a Stripe test event, a cross-environment event —
  // updates 0 rows instead of throwing P2025 and returning a 500 that Stripe
  // then retries forever.
  const { count } = await prisma.committee.updateMany({
    where: { id: committeeId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: toSubscriptionStatus(subscription.status),
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    },
  })
  if (count === 0) {
    console.warn(`[billing] checkout session for unknown committee ${committeeId} — skipped`)
    return null
  }
  return committeeId
}
