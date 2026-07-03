'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import type { Expenditure, PaymentMethod, ExpenseCategory } from '@/lib/types'

type PrismaExpenditure = {
  id: string
  committeeId: string
  amount: { toString(): string }
  date: Date
  payee: string
  purpose: string
  category: string
  method: string
  checkNumber: string | null
  memo: string | null
  filedAt: Date | null
  eventId: string | null
  createdAt: Date
}

function mapExpenditure(e: PrismaExpenditure): Expenditure {
  return {
    id: e.id,
    committeeId: e.committeeId,
    amount: Number(e.amount.toString()),
    date: e.date.toISOString().split('T')[0],
    payee: e.payee,
    purpose: e.purpose,
    category: e.category as ExpenseCategory,
    method: e.method as PaymentMethod,
    checkNumber: e.checkNumber ?? undefined,
    memo: e.memo ?? undefined,
    filedAt: e.filedAt?.toISOString() ?? undefined,
    eventId: e.eventId ?? undefined,
    createdAt: e.createdAt.toISOString(),
  }
}

export async function getExpenditures(committeeId: string): Promise<Expenditure[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.expenditure.findMany({
    where: { committeeId },
    orderBy: { date: 'desc' },
  })
  return rows.map(mapExpenditure)
}

export async function createExpenditure(
  committeeId: string,
  data: {
    amount: number
    date: string
    payee: string
    purpose: string
    category: ExpenseCategory
    method: PaymentMethod
    checkNumber?: string
    memo?: string
    eventId?: string
  },
  committeeSlug: string
): Promise<Expenditure> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  const expenditure = await prisma.expenditure.create({
    data: {
      committeeId,
      amount: data.amount,
      date: new Date(data.date),
      payee: data.payee,
      purpose: data.purpose,
      category: data.category,
      method: data.method,
      checkNumber: data.checkNumber,
      memo: data.memo,
      eventId,
    },
  })

  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapExpenditure(expenditure)
}

/** Validate an event belongs to the committee; returns null if unset. */
async function resolveEventId(eventId: string | undefined, committeeId: string): Promise<string | null> {
  if (!eventId) return null
  const event = await prisma.event.findFirst({ where: { id: eventId, committeeId }, select: { id: true } })
  if (!event) throw new Error('Event not found for this committee')
  return event.id
}

export async function updateExpenditure(
  id: string,
  data: {
    amount: number
    date: string
    payee: string
    purpose: string
    category: ExpenseCategory
    method: PaymentMethod
    checkNumber?: string
    memo?: string
    eventId?: string
  },
  committeeSlug: string
): Promise<Expenditure> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.expenditure.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  const expenditure = await prisma.expenditure.update({
    where: { id },
    data: {
      amount: data.amount,
      date: new Date(data.date),
      payee: data.payee,
      purpose: data.purpose,
      category: data.category,
      method: data.method,
      checkNumber: data.checkNumber ?? null,
      memo: data.memo ?? null,
      eventId,
    },
  })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapExpenditure(expenditure)
}

export async function deleteExpenditure(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.expenditure.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  await prisma.expenditure.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}
