import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { applyCheckoutSession } from '@/lib/billing'
import { FINANCE_ROLES } from '@/lib/auth'

/**
 * Stripe Checkout returns here on success. This route lives outside the
 * committee entitlement gate, so it can verify the just-completed session and
 * flip the committee to its trial/active status *before* redirecting into the
 * gated app — a paying user is no longer stranded at the paywall if the async
 * webhook is slow or (as we hit in production) failing signature verification.
 * The update is idempotent with the webhook.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; session_id?: string }>
}) {
  const { slug, session_id } = await searchParams
  if (!slug) redirect('/app')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dashboard = `/app/${slug}/dashboard`

  // Best-effort self-heal. Any failure just falls through to the dashboard,
  // where the normal entitlement gate applies exactly as before — so this can
  // only help, never make things worse.
  if (session_id) {
    try {
      const membership = await prisma.committeeMembership.findFirst({
        where: { userId: user.id, committee: { slug }, role: { in: FINANCE_ROLES } },
        include: { committee: true },
      })
      if (membership) {
        const session = await stripe.checkout.sessions.retrieve(session_id)
        // Only trust a completed session that belongs to *this* committee
        const paid = session.status === 'complete' || session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
        if (paid && session.metadata?.committeeId === membership.committeeId) {
          await applyCheckoutSession(session)
        }
      }
    } catch (err) {
      console.error('[checkout-return] self-heal failed (falling through to gate):', err)
    }
  }

  redirect(dashboard)
}
