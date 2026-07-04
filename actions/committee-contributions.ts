'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import type { CommitteeContribution, PaymentMethod } from '@/lib/types'

type PrismaRow = {
  id: string
  committeeId: string
  fromName: string
  treasurerName: string | null
  street: string | null
  city: string | null
  state: string
  zip: string | null
  date: Date
  amount: { toString(): string }
  method: string | null
  eventId: string | null
  memo: string | null
  filedAt: Date | null
  createdAt: Date
}

function mapRow(r: PrismaRow): CommitteeContribution {
  return {
    id: r.id,
    committeeId: r.committeeId,
    fromName: r.fromName,
    treasurerName: r.treasurerName ?? undefined,
    street: r.street ?? undefined,
    city: r.city ?? undefined,
    state: r.state,
    zip: r.zip ?? undefined,
    date: r.date.toISOString().split('T')[0],
    amount: Number(r.amount.toString()),
    method: (r.method as PaymentMethod) ?? undefined,
    eventId: r.eventId ?? undefined,
    memo: r.memo ?? undefined,
    filedAt: r.filedAt?.toISOString() ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }
}

export interface CommitteeContributionInput {
  fromName: string
  treasurerName?: string
  street?: string
  city?: string
  state?: string
  zip?: string
  date: string
  amount: number
  method?: PaymentMethod
  eventId?: string
  memo?: string
}

export async function getCommitteeContributions(committeeId: string): Promise<CommitteeContribution[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.committeeContribution.findMany({ where: { committeeId }, orderBy: { date: 'desc' } })
  return rows.map(mapRow)
}

/** Validate a linked event belongs to the committee; null if unset. */
async function resolveEventId(eventId: string | undefined, committeeId: string): Promise<string | null> {
  if (!eventId) return null
  const event = await prisma.event.findFirst({ where: { id: eventId, committeeId }, select: { id: true } })
  if (!event) throw new Error('Event not found for this committee')
  return event.id
}

export async function createCommitteeContribution(
  committeeId: string,
  data: CommitteeContributionInput,
  committeeSlug: string
): Promise<CommitteeContribution> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  const row = await prisma.committeeContribution.create({
    data: {
      committeeId,
      fromName: data.fromName,
      treasurerName: data.treasurerName || null,
      street: data.street || null,
      city: data.city || null,
      state: data.state || 'CT',
      zip: data.zip || null,
      date: new Date(data.date),
      amount: data.amount,
      method: data.method || null,
      eventId,
      memo: data.memo || null,
    },
  })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapRow(row)
}

export async function updateCommitteeContribution(
  id: string,
  data: CommitteeContributionInput,
  committeeSlug: string
): Promise<CommitteeContribution> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.committeeContribution.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  const row = await prisma.committeeContribution.update({
    where: { id },
    data: {
      fromName: data.fromName,
      treasurerName: data.treasurerName || null,
      street: data.street || null,
      city: data.city || null,
      state: data.state || 'CT',
      zip: data.zip || null,
      date: new Date(data.date),
      amount: data.amount,
      method: data.method || null,
      eventId,
      memo: data.memo || null,
    },
  })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapRow(row)
}

export async function deleteCommitteeContribution(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.committeeContribution.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  await prisma.committeeContribution.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}
