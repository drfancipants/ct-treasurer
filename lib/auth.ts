import { MemberRole } from '@prisma/client'
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

/**
 * Roles allowed to modify financial records (contributions, expenditures,
 * bank accounts, reconciliation, filings). Everyone else is read-only —
 * under SEEC the treasurer is legally responsible for the books.
 */
export const FINANCE_ROLES: MemberRole[] = [MemberRole.TREASURER, MemberRole.ASSISTANT_TREASURER]

export function canEditFinances(role: string): boolean {
  return (FINANCE_ROLES as string[]).includes(role)
}

/** Verify membership AND a role that may modify financial records. */
export async function requireFinanceRole(committeeSlug: string) {
  const ctx = await requireCommitteeMember(committeeSlug)
  if (!canEditFinances(ctx.role)) throw new Error('Forbidden')
  return ctx
}

/**
 * Roles allowed to maintain the committee roster (member list, dues, active
 * status). Not a financial record, so officers beyond the treasurer may edit.
 */
export const ROSTER_ROLES: MemberRole[] = [
  MemberRole.TREASURER,
  MemberRole.ASSISTANT_TREASURER,
  MemberRole.CHAIRPERSON,
  MemberRole.SECRETARY,
]

export function canEditRoster(role: string): boolean {
  return (ROSTER_ROLES as string[]).includes(role)
}

/** Verify membership AND a role that may maintain the committee roster. */
export async function requireRosterRole(committeeSlug: string) {
  const ctx = await requireCommitteeMember(committeeSlug)
  if (!canEditRoster(ctx.role)) throw new Error('Forbidden')
  return ctx
}
