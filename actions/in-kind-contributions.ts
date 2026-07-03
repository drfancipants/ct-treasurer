'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import type { InKindContribution, InKindEntityType } from '@/lib/types'

type PrismaRow = {
  id: string
  committeeId: string
  entityType: string
  lastName: string
  firstName: string | null
  middleInitial: string | null
  entityName: string | null
  street: string | null
  city: string | null
  state: string
  zip: string | null
  date: Date
  fairMarketValue: { toString(): string }
  description: string
  isStateContractorPrincipal: boolean
  contractorBranch: string | null
  isLobbyist: boolean
  eventId: string | null
  memo: string | null
  filedAt: Date | null
  createdAt: Date
}

function mapRow(r: PrismaRow): InKindContribution {
  return {
    id: r.id,
    committeeId: r.committeeId,
    entityType: r.entityType as InKindEntityType,
    lastName: r.lastName,
    firstName: r.firstName ?? undefined,
    middleInitial: r.middleInitial ?? undefined,
    entityName: r.entityName ?? undefined,
    street: r.street ?? undefined,
    city: r.city ?? undefined,
    state: r.state,
    zip: r.zip ?? undefined,
    date: r.date.toISOString().split('T')[0],
    fairMarketValue: Number(r.fairMarketValue.toString()),
    description: r.description,
    isStateContractorPrincipal: r.isStateContractorPrincipal,
    contractorBranch: r.contractorBranch ?? undefined,
    isLobbyist: r.isLobbyist,
    eventId: r.eventId ?? undefined,
    memo: r.memo ?? undefined,
    filedAt: r.filedAt?.toISOString() ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }
}

export interface InKindContributionInput {
  entityType: InKindEntityType
  lastName: string
  firstName?: string
  middleInitial?: string
  entityName?: string
  street?: string
  city?: string
  state?: string
  zip?: string
  date: string
  fairMarketValue: number
  description: string
  isStateContractorPrincipal: boolean
  contractorBranch?: string
  isLobbyist: boolean
  eventId?: string
  memo?: string
}

export async function getInKindContributions(committeeId: string): Promise<InKindContribution[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.inKindContribution.findMany({ where: { committeeId }, orderBy: { date: 'desc' } })
  return rows.map(mapRow)
}

async function resolveEventId(eventId: string | undefined, committeeId: string): Promise<string | null> {
  if (!eventId) return null
  const event = await prisma.event.findFirst({ where: { id: eventId, committeeId }, select: { id: true } })
  if (!event) throw new Error('Event not found for this committee')
  return event.id
}

function toData(data: InKindContributionInput, eventId: string | null) {
  return {
    entityType: data.entityType,
    lastName: data.lastName,
    firstName: data.firstName || null,
    middleInitial: data.middleInitial || null,
    entityName: data.entityName || null,
    street: data.street || null,
    city: data.city || null,
    state: data.state || 'CT',
    zip: data.zip || null,
    date: new Date(data.date),
    fairMarketValue: data.fairMarketValue,
    description: data.description,
    isStateContractorPrincipal: data.isStateContractorPrincipal,
    contractorBranch: data.isStateContractorPrincipal ? (data.contractorBranch || null) : null,
    isLobbyist: data.isLobbyist,
    eventId,
    memo: data.memo || null,
  }
}

export async function createInKindContribution(
  committeeId: string,
  data: InKindContributionInput,
  committeeSlug: string
): Promise<InKindContribution> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  const row = await prisma.inKindContribution.create({ data: { committeeId, ...toData(data, eventId) } })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapRow(row)
}

export async function updateInKindContribution(
  id: string,
  data: InKindContributionInput,
  committeeSlug: string
): Promise<InKindContribution> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.inKindContribution.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  const row = await prisma.inKindContribution.update({ where: { id }, data: toData(data, eventId) })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapRow(row)
}

export async function deleteInKindContribution(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.inKindContribution.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  await prisma.inKindContribution.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}
