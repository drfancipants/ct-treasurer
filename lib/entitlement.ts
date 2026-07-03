import type { Committee } from '@/lib/types'

/**
 * A committee may be used only while its own subscription is active or in an
 * unexpired trial. Billing is per-committee, so this is independent of any
 * other committee the same user pays for. null (never subscribed), past_due,
 * canceled, or an expired trial all fail — the layout redirects those to the
 * subscribe page.
 */
export function isCommitteeEntitled(
  committee: Pick<Committee, 'subscriptionStatus' | 'trialEndsAt'>
): boolean {
  const status = committee.subscriptionStatus
  if (status === 'active') return true
  if (status === 'trialing') {
    // The Stripe webhook flips trialing → active/past_due at trial end; this
    // date check blocks access if that update is delayed past the trial.
    if (!committee.trialEndsAt) return true
    return new Date(committee.trialEndsAt).getTime() > Date.now()
  }
  return false
}
