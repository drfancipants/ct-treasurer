'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
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

function mapMember(m: MembershipWithUser): CommitteeMember {
  return {
    id: m.id,
    committeeId: m.committeeId,
    userId: m.userId,
    name: m.user.name ?? m.user.email.split('@')[0],
    email: m.user.email,
    role: m.role as MemberRole,
    phone: m.user.phone ?? undefined,
    joinedAt: m.joinedAt.toISOString().split('T')[0],
  }
}

export async function getMembers(committeeId: string): Promise<CommitteeMember[]> {
  const memberships = await prisma.committeeMembership.findMany({
    where: { committeeId },
    include: { user: true },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  })
  return memberships.map(mapMember)
}

export async function updateMemberRole(
  membershipId: string,
  role: MemberRole,
  committeeSlug: string
) {
  await prisma.committeeMembership.update({
    where: { id: membershipId },
    data: { role },
  })
  revalidatePath(`/app/${committeeSlug}/members`)
}

export async function removeMember(membershipId: string, committeeSlug: string) {
  await prisma.committeeMembership.delete({
    where: { id: membershipId },
  })
  revalidatePath(`/app/${committeeSlug}/members`)
}
