'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { mapCommittee } from '@/lib/map-committee'
import type { Committee } from '@/lib/types'

/** All committees the current user belongs to */
export async function getCommitteesForUser(): Promise<Committee[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const memberships = await prisma.committeeMembership.findMany({
    where: { userId: user.id },
    include: { committee: true },
    orderBy: { committee: { name: 'asc' } },
  })

  return memberships.map((m: { committee: Parameters<typeof mapCommittee>[0] }) => mapCommittee(m.committee))
}

/** Single committee by slug — verifies the current user has access */
export async function getCommitteeBySlug(slug: string): Promise<Committee | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committee: { slug } },
    include: { committee: true },
  })

  return membership ? mapCommittee(membership.committee) : null
}

export async function createCommittee(data: {
  name: string
  slug: string
  electionYear?: number
  city?: string
}): Promise<Committee> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const existing = await prisma.committee.findUnique({ where: { slug: data.slug } })
  if (existing) throw new Error('That URL is already taken — choose a different one')

  // Ensure a User row exists in the public schema (self-serve signup only
  // creates auth.users — the FK on CommitteeMembership requires this row).
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email!, name: user.user_metadata?.name ?? null },
    update: {},
  })

  const committee = await prisma.committee.create({
    data: {
      name: data.name,
      slug: data.slug,
      electionYear: data.electionYear ?? null,
      city: data.city ?? null,
      memberships: {
        create: { userId: user.id, role: 'TREASURER' },
      },
    },
  })

  revalidatePath('/app')
  return mapCommittee(committee)
}

export async function updateCommittee(
  committeeId: string,
  data: {
    name: string
    seecId?: string
    anedotAccountId?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    phone?: string
    email?: string
    electionYear?: number
    duesAnedotCampaign?: string
    duesThreshold?: number
  },
  committeeSlug: string
): Promise<Committee> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const membership = await prisma.committeeMembership.findFirst({
    where: {
      userId: user.id,
      committeeId,
      role: { in: ['TREASURER', 'ASSISTANT_TREASURER'] },
    },
  })
  if (!membership) throw new Error('Forbidden')

  const committee = await prisma.committee.update({
    where: { id: committeeId },
    data: {
      name: data.name,
      seecId: data.seecId ?? null,
      anedotAccountId: data.anedotAccountId ?? null,
      address1: data.address1 ?? null,
      address2: data.address2 ?? null,
      city: data.city ?? null,
      state: data.state ?? 'CT',
      zip: data.zip ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      electionYear: data.electionYear ?? null,
      duesAnedotCampaign: data.duesAnedotCampaign ?? null,
      duesThreshold: data.duesThreshold ?? null,
    },
  })

  revalidatePath(`/app/${committeeSlug}/settings`)
  revalidatePath(`/app/${committeeSlug}`, 'layout')
  return mapCommittee(committee)
}
