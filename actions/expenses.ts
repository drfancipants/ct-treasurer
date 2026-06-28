'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
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
    createdAt: e.createdAt.toISOString(),
  }
}

export async function getExpenditures(committeeId: string): Promise<Expenditure[]> {
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
  },
  committeeSlug: string
): Promise<Expenditure> {
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
    },
  })

  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapExpenditure(expenditure)
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
  },
  committeeSlug: string
): Promise<Expenditure> {
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
    },
  })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapExpenditure(expenditure)
}

export async function deleteExpenditure(id: string, committeeSlug: string) {
  await prisma.expenditure.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}
