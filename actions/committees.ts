'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { mapCommittee } from '@/lib/map-committee'
import { canEditFinances } from '@/lib/auth'
import { upsertAuthUser } from '@/lib/user-sync'
import type { Committee, CommitteeType, OfficeSought } from '@/lib/types'
import { OFFICE_LABELS } from '@/lib/types'

/** Parse an ISO yyyy-mm-dd string to a Date at UTC midnight, or null. */
function parseDateOnly(iso: string | undefined): Date | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00Z`)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`)
  return d
}

function validateCandidateFields(data: {
  type?: CommitteeType
  candidateName?: string
  officeSought?: OfficeSought
  primaryDate?: string
  electionDate?: string
}) {
  if (!data.candidateName?.trim()) throw new Error('Candidate name is required for a candidate committee')
  if (!data.officeSought || !(data.officeSought in OFFICE_LABELS)) {
    throw new Error('Office sought is required for a candidate committee')
  }
  if (data.primaryDate && data.electionDate && data.primaryDate >= data.electionDate) {
    throw new Error('The primary date must be before the election date')
  }
}

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
  type?: CommitteeType
  candidateName?: string
  officeSought?: OfficeSought
  district?: string
  cepParticipant?: boolean
  primaryDate?: string
  electionDate?: string
}): Promise<Committee> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const existing = await prisma.committee.findUnique({ where: { slug: data.slug } })
  if (existing) throw new Error('That URL is already taken — choose a different one')

  const type: CommitteeType = data.type === 'CANDIDATE' ? 'CANDIDATE' : 'PARTY'
  if (type === 'CANDIDATE') validateCandidateFields(data)

  // Ensure a User row exists in the public schema (self-serve signup only
  // creates auth.users — the FK on CommitteeMembership requires this row).
  await upsertAuthUser(
    user.id,
    user.email!,
    { name: user.user_metadata?.name ?? null },
    {}
  )

  const committee = await prisma.committee.create({
    data: {
      name: data.name,
      slug: data.slug,
      electionYear: data.electionYear ?? null,
      city: data.city ?? null,
      type,
      candidateName: type === 'CANDIDATE' ? data.candidateName!.trim() : null,
      officeSought: type === 'CANDIDATE' ? data.officeSought : null,
      district: type === 'CANDIDATE' ? data.district?.trim() || null : null,
      cepParticipant: type === 'CANDIDATE' ? !!data.cepParticipant : false,
      primaryDate: type === 'CANDIDATE' ? parseDateOnly(data.primaryDate) : null,
      electionDate: type === 'CANDIDATE' ? parseDateOnly(data.electionDate) : null,
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
    candidateName?: string
    officeSought?: OfficeSought
    district?: string
    cepParticipant?: boolean
    primaryDate?: string
    electionDate?: string
  },
  committeeSlug: string
): Promise<Committee> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId },
    include: { committee: { select: { type: true } } },
  })
  if (!membership || !canEditFinances(membership.role)) throw new Error('Forbidden')

  // `type` is immutable and candidate fields only apply to candidate committees —
  // the stored type decides, never the client payload.
  const isCandidate = membership.committee.type === 'CANDIDATE'
  if (isCandidate) validateCandidateFields(data)

  const committee = await prisma.committee.update({
    where: { id: committeeId },
    data: {
      ...(isCandidate
        ? {
            candidateName: data.candidateName!.trim(),
            officeSought: data.officeSought,
            district: data.district?.trim() || null,
            cepParticipant: !!data.cepParticipant,
            primaryDate: parseDateOnly(data.primaryDate),
            electionDate: parseDateOnly(data.electionDate),
          }
        : {}),
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
