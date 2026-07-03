'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import { chooseEventLetter } from '@/lib/events'
import type { CommitteeEvent } from '@/lib/types'

type PrismaEvent = {
  id: string
  committeeId: string
  date: Date
  letter: string
  description: string
  isFundraiser: boolean
  street: string | null
  city: string | null
  state: string
  zip: string | null
  isPersonalResidence: boolean
  hadDonatedGoods: boolean
  wasTagSale: boolean
  hadProgramBook: boolean
  soldFoodAtFair: boolean
  foodReceipts: { toString(): string }
  tagSaleReceipts: { toString(): string }
  notes: string | null
  createdAt: Date
}

function mapEvent(e: PrismaEvent): CommitteeEvent {
  return {
    id: e.id,
    committeeId: e.committeeId,
    date: e.date.toISOString().split('T')[0],
    letter: e.letter,
    description: e.description,
    isFundraiser: e.isFundraiser,
    street: e.street ?? undefined,
    city: e.city ?? undefined,
    state: e.state,
    zip: e.zip ?? undefined,
    isPersonalResidence: e.isPersonalResidence,
    hadDonatedGoods: e.hadDonatedGoods,
    wasTagSale: e.wasTagSale,
    hadProgramBook: e.hadProgramBook,
    soldFoodAtFair: e.soldFoodAtFair,
    foodReceipts: Number(e.foodReceipts.toString()),
    tagSaleReceipts: Number(e.tagSaleReceipts.toString()),
    notes: e.notes ?? undefined,
    createdAt: e.createdAt.toISOString(),
  }
}

export interface EventInput {
  /** Optional event letter to assign; must be unused in the committee. Auto-assigned if omitted. */
  letter?: string
  date: string
  description: string
  isFundraiser: boolean
  street?: string
  city?: string
  state?: string
  zip?: string
  isPersonalResidence: boolean
  hadDonatedGoods: boolean
  wasTagSale: boolean
  hadProgramBook: boolean
  soldFoodAtFair: boolean
  foodReceipts: number
  tagSaleReceipts: number
  notes?: string
}

export async function getEvents(committeeId: string): Promise<CommitteeEvent[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.event.findMany({ where: { committeeId }, orderBy: { date: 'asc' } })
  return rows.map(mapEvent)
}

/**
 * Resolve the letter to store: a user-chosen unused letter, or the first
 * available one. `exceptId` lets an event keep its own letter on update.
 */
async function resolveLetter(
  committeeId: string,
  requested: string | undefined,
  exceptId?: string
): Promise<string> {
  const others = await prisma.event.findMany({
    where: { committeeId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { letter: true },
  })
  return chooseEventLetter(requested, others.map((e) => e.letter))
}

export async function createEvent(
  committeeId: string,
  data: EventInput,
  committeeSlug: string
): Promise<CommitteeEvent> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const letter = await resolveLetter(committeeId, data.letter)
  const event = await prisma.event.create({
    data: {
      committeeId,
      letter,
      date: new Date(data.date),
      description: data.description,
      isFundraiser: data.isFundraiser,
      street: data.street || null,
      city: data.city || null,
      state: data.state || 'CT',
      zip: data.zip || null,
      isPersonalResidence: data.isPersonalResidence,
      hadDonatedGoods: data.hadDonatedGoods,
      wasTagSale: data.wasTagSale,
      hadProgramBook: data.hadProgramBook,
      soldFoodAtFair: data.soldFoodAtFair,
      foodReceipts: data.foodReceipts,
      tagSaleReceipts: data.tagSaleReceipts,
      notes: data.notes || null,
    },
  })
  revalidatePath(`/app/${committeeSlug}/events`)
  return mapEvent(event)
}

export async function updateEvent(
  eventId: string,
  data: EventInput,
  committeeSlug: string
): Promise<CommitteeEvent> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.event.findFirst({ where: { id: eventId, committeeId } })
  if (!existing) throw new Error('Forbidden')

  // Keep the current letter unless a different (unused) one was chosen
  const letter = await resolveLetter(committeeId, data.letter || existing.letter, eventId)
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      letter,
      date: new Date(data.date),
      description: data.description,
      isFundraiser: data.isFundraiser,
      street: data.street || null,
      city: data.city || null,
      state: data.state || 'CT',
      zip: data.zip || null,
      isPersonalResidence: data.isPersonalResidence,
      hadDonatedGoods: data.hadDonatedGoods,
      wasTagSale: data.wasTagSale,
      hadProgramBook: data.hadProgramBook,
      soldFoodAtFair: data.soldFoodAtFair,
      foodReceipts: data.foodReceipts,
      tagSaleReceipts: data.tagSaleReceipts,
      notes: data.notes || null,
    },
  })
  revalidatePath(`/app/${committeeSlug}/events`)
  return mapEvent(event)
}

export async function deleteEvent(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.event.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  await prisma.event.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/events`)
}
