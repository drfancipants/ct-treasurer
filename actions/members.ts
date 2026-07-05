'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMember, requireCommitteeMemberById, canEditFinances } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import type { CommitteeMember, MemberRole } from '@/lib/types'

type MembershipWithUser = {
  id: string
  committeeId: string
  userId: string
  role: string
  joinedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
}

function mapMember(m: MembershipWithUser, pendingInvite = false): CommitteeMember {
  return {
    id: m.id,
    committeeId: m.committeeId,
    userId: m.userId,
    name: m.user.name ?? m.user.email.split('@')[0],
    email: m.user.email,
    role: m.role as MemberRole,
    phone: m.user.phone ?? undefined,
    joinedAt: m.joinedAt.toISOString().split('T')[0],
    pendingInvite,
  }
}

export async function getMembers(committeeId: string): Promise<CommitteeMember[]> {
  await requireCommitteeMemberById(committeeId)
  const memberships = await prisma.committeeMembership.findMany({
    where: { committeeId },
    include: { user: true },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  })

  // Cross-reference Supabase Auth to flag members who were invited but have
  // never signed in — lets the UI offer "resend invite" only where it's
  // actually useful, instead of on everyone.
  let neverSignedIn = new Set<string>()
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data } = await createAdminClient().auth.admin.listUsers()
      neverSignedIn = new Set(
        data.users
          .filter((u: { id: string; last_sign_in_at?: string | null }) => !u.last_sign_in_at)
          .map((u: { id: string }) => u.id)
      )
    } catch {
      // Non-fatal — the tab still works, just without the pending-invite flag
    }
  }

  return memberships.map((m) => mapMember(m, neverSignedIn.has(m.userId)))
}

export interface MemberUpdateInput {
  name: string
  phone?: string
}

/**
 * Updates a member's name/phone — these live on the shared User row (not
 * per-committee), so the change is visible across every committee they
 * belong to. Email is intentionally not editable here: it's tied to their
 * Supabase Auth identity and login credential, not just a contact field.
 */
export async function updateMember(
  membershipId: string,
  data: MemberUpdateInput,
  committeeSlug: string
): Promise<CommitteeMember> {
  const { committeeId, role: callerRole } = await requireCommitteeMember(committeeSlug)
  if (!canEditFinances(callerRole)) throw new Error('Forbidden')

  const target = await prisma.committeeMembership.findFirst({ where: { id: membershipId, committeeId } })
  if (!target) throw new Error('Forbidden')

  if (!data.name.trim()) throw new Error('Name is required')

  await prisma.user.update({
    where: { id: target.userId },
    data: { name: data.name.trim(), phone: data.phone?.trim() || null },
  })

  const updated = await prisma.committeeMembership.findFirstOrThrow({
    where: { id: membershipId },
    include: { user: true },
  })
  revalidatePath(`/app/${committeeSlug}/members`)
  return mapMember(updated)
}

export async function updateMemberRole(
  membershipId: string,
  role: MemberRole,
  committeeSlug: string
) {
  const { committeeId, role: callerRole } = await requireCommitteeMember(committeeSlug)
  if (!canEditFinances(callerRole)) throw new Error('Forbidden')

  const target = await prisma.committeeMembership.findFirst({ where: { id: membershipId, committeeId } })
  if (!target) throw new Error('Forbidden')

  await prisma.committeeMembership.update({ where: { id: membershipId }, data: { role } })
  revalidatePath(`/app/${committeeSlug}/members`)
}

export async function removeMember(membershipId: string, committeeSlug: string) {
  const { committeeId, role: callerRole } = await requireCommitteeMember(committeeSlug)
  if (!canEditFinances(callerRole)) throw new Error('Forbidden')

  const target = await prisma.committeeMembership.findFirst({ where: { id: membershipId, committeeId } })
  if (!target) throw new Error('Forbidden')

  await prisma.committeeMembership.delete({ where: { id: membershipId } })
  revalidatePath(`/app/${committeeSlug}/members`)
}
