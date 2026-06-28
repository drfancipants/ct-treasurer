import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

/**
 * Verifies the current session user is a member of the committee identified
 * by slug. Throws 'Unauthorized' (no session) or 'Forbidden' (not a member).
 * Returns { userId, committeeId } for use in scoped Prisma queries.
 */
export async function requireCommitteeMember(committeeSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committee: { slug: committeeSlug } },
  })
  if (!membership) throw new Error('Forbidden')

  return { userId: user.id, committeeId: membership.committeeId }
}
