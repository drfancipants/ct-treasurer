'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import type { Reimbursement, ExpenseCategory, PaymentMethod } from '@/lib/types'

type PrismaRow = {
  id: string
  committeeId: string
  workerLastName: string
  workerFirstName: string
  workerMiddleInitial: string | null
  description: string
  date: Date
  amount: { toString(): string }
  method: string
  checkNumber: string | null
  vendorName: string | null
  street: string | null
  city: string | null
  state: string
  zip: string | null
  category: string
  expenditureId: string | null
  eventId: string | null
  memo: string | null
  filedAt: Date | null
  createdAt: Date
}

function mapRow(r: PrismaRow): Reimbursement {
  return {
    id: r.id,
    committeeId: r.committeeId,
    workerLastName: r.workerLastName,
    workerFirstName: r.workerFirstName,
    workerMiddleInitial: r.workerMiddleInitial ?? undefined,
    description: r.description,
    date: r.date.toISOString().split('T')[0],
    amount: Number(r.amount.toString()),
    method: r.method as PaymentMethod,
    checkNumber: r.checkNumber ?? undefined,
    vendorName: r.vendorName ?? undefined,
    street: r.street ?? undefined,
    city: r.city ?? undefined,
    state: r.state,
    zip: r.zip ?? undefined,
    category: r.category as ExpenseCategory,
    expenditureId: r.expenditureId ?? undefined,
    eventId: r.eventId ?? undefined,
    memo: r.memo ?? undefined,
    filedAt: r.filedAt?.toISOString() ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }
}

export interface ReimbursementInput {
  workerLastName: string
  workerFirstName: string
  workerMiddleInitial?: string
  description: string
  date: string
  amount: number
  method: PaymentMethod
  checkNumber?: string
  vendorName?: string
  street?: string
  city?: string
  state?: string
  zip?: string
  category: ExpenseCategory
  expenditureId?: string
  eventId?: string
  memo?: string
}

export async function getReimbursements(committeeId: string): Promise<Reimbursement[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.reimbursement.findMany({ where: { committeeId }, orderBy: { date: 'desc' } })
  return rows.map(mapRow)
}

async function resolveEventId(eventId: string | undefined, committeeId: string): Promise<string | null> {
  if (!eventId) return null
  const event = await prisma.event.findFirst({ where: { id: eventId, committeeId }, select: { id: true } })
  if (!event) throw new Error('Event not found for this committee')
  return event.id
}

async function resolveExpenditureId(expenditureId: string | undefined, committeeId: string): Promise<string | null> {
  if (!expenditureId) return null
  const expenditure = await prisma.expenditure.findFirst({ where: { id: expenditureId, committeeId }, select: { id: true } })
  if (!expenditure) throw new Error('Expenditure not found for this committee')
  return expenditure.id
}

function toData(data: ReimbursementInput, expenditureId: string | null, eventId: string | null) {
  return {
    workerLastName: data.workerLastName,
    workerFirstName: data.workerFirstName,
    workerMiddleInitial: data.workerMiddleInitial || null,
    description: data.description,
    date: new Date(data.date),
    amount: data.amount,
    method: data.method,
    checkNumber: data.checkNumber || null,
    vendorName: data.vendorName || null,
    street: data.street || null,
    city: data.city || null,
    state: data.state || 'CT',
    zip: data.zip || null,
    category: data.category,
    expenditureId,
    eventId,
    memo: data.memo || null,
  }
}

export async function createReimbursement(
  committeeId: string,
  data: ReimbursementInput,
  committeeSlug: string
): Promise<Reimbursement> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const expenditureId = await resolveExpenditureId(data.expenditureId, committeeId)
  const eventId = await resolveEventId(data.eventId, committeeId)

  const row = await prisma.reimbursement.create({ data: { committeeId, ...toData(data, expenditureId, eventId) } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapRow(row)
}

export async function updateReimbursement(
  id: string,
  data: ReimbursementInput,
  committeeSlug: string
): Promise<Reimbursement> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.reimbursement.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  const expenditureId = await resolveExpenditureId(data.expenditureId, committeeId)
  const eventId = await resolveEventId(data.eventId, committeeId)

  const row = await prisma.reimbursement.update({ where: { id }, data: toData(data, expenditureId, eventId) })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapRow(row)
}

export async function deleteReimbursement(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.reimbursement.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  await prisma.reimbursement.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}
