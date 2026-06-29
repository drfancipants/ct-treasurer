import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

/** Verify membership by committee slug (use when slug is available in the route). */
export async function requireCommitteeMember(committeeSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committee: { slug: committeeSlug } },
    select: { committeeId: true, role: true },
  })
  if (!membership) throw new Error('Forbidden')

  return { userId: user.id, committeeId: membership.committeeId, role: membership.role }
}

/** Verify membership by committeeId (use in read actions that receive an ID, not a slug). */
export async function requireCommitteeMemberById(committeeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId },
    select: { committeeId: true, role: true },
  })
  if (!membership) throw new Error('Forbidden')
  return { userId: user.id, committeeId: membership.committeeId, role: membership.role }
}
