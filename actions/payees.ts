'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import type { Payee, ExpenseCategory } from '@/lib/types'

type PrismaPayee = {
  id: string
  committeeId: string
  name: string
  address1: string | null
  city: string | null
  state: string
  zip: string | null
  defaultCategory: string
  defaultPurpose: string | null
  createdAt: Date
  updatedAt: Date
}

function mapPayee(p: PrismaPayee): Payee {
  return {
    id: p.id,
    committeeId: p.committeeId,
    name: p.name,
    address1: p.address1 ?? undefined,
    city: p.city ?? undefined,
    state: p.state,
    zip: p.zip ?? undefined,
    defaultCategory: p.defaultCategory as ExpenseCategory,
    defaultPurpose: p.defaultPurpose ?? undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

export interface PayeeInput {
  name: string
  address1?: string
  city?: string
  state?: string
  zip?: string
  defaultCategory: ExpenseCategory
  defaultPurpose?: string
}

function toData(data: PayeeInput) {
  return {
    name: data.name,
    address1: data.address1 || null,
    city: data.city || null,
    state: data.state || 'CT',
    zip: data.zip || null,
    defaultCategory: data.defaultCategory,
    defaultPurpose: data.defaultPurpose || null,
  }
}

export async function getPayees(committeeId: string): Promise<Payee[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.payee.findMany({
    where: { committeeId },
    orderBy: { name: 'asc' },
  })
  return rows.map(mapPayee)
}

export async function createPayee(
  committeeId: string,
  data: PayeeInput,
  committeeSlug: string
): Promise<Payee> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const payee = await prisma.payee.create({ data: { committeeId, ...toData(data) } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  return mapPayee(payee)
}

export async function updatePayee(
  id: string,
  data: PayeeInput,
  committeeSlug: string
): Promise<Payee> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.payee.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  const payee = await prisma.payee.update({ where: { id }, data: toData(data) })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  return mapPayee(payee)
}

export async function deletePayee(id: string, committeeSlug: string): Promise<void> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.payee.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  await prisma.payee.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
}
