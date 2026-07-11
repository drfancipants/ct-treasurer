'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import { groupFeesByPeriod } from '@/lib/anedot-fees'
import { generateQuarterlyPeriods, generateStatutoryCandidatePeriods, mergeFilingPeriods } from '@/lib/filing-periods'
import type { Expenditure, PaymentMethod, ExpenseCategory } from '@/lib/types'

type PrismaExpenditure = {
  id: string
  committeeId: string
  amount: { toString(): string }
  date: Date
  payee: string
  payeeAddress1: string | null
  payeeCity: string | null
  payeeState: string | null
  payeeZip: string | null
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
    payeeAddress1: e.payeeAddress1 ?? undefined,
    payeeCity: e.payeeCity ?? undefined,
    payeeState: e.payeeState ?? undefined,
    payeeZip: e.payeeZip ?? undefined,
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
    payeeAddress1?: string
    payeeCity?: string
    payeeState?: string
    payeeZip?: string
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
      payeeAddress1: data.payeeAddress1 || null,
      payeeCity: data.payeeCity || null,
      payeeState: data.payeeState || null,
      payeeZip: data.payeeZip || null,
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
    payeeAddress1?: string
    payeeCity?: string
    payeeState?: string
    payeeZip?: string
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
      payeeAddress1: data.payeeAddress1 || null,
      payeeCity: data.payeeCity || null,
      payeeState: data.payeeState || null,
      payeeZip: data.payeeZip || null,
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

// ─── Anedot processing fees ───────────────────────────────────────────────────

export interface UnrecordedFees {
  total: number
  count: number
}

/** Anedot fees captured on donations but not yet reported as an expenditure. */
export async function getUnrecordedAnedotFees(committeeId: string): Promise<UnrecordedFees> {
  await requireCommitteeMemberById(committeeId)
  const agg = await prisma.contribution.aggregate({
    where: { committeeId, processingFee: { gt: 0 }, feeExpenditureId: null },
    _sum: { processingFee: true },
    _count: true,
  })
  return {
    total: Number(agg._sum.processingFee?.toString() ?? 0),
    count: agg._count,
  }
}

/**
 * Report accumulated Anedot fees as expenditures — one per filing period
 * (payee "Anedot", SEEC purpose BNK) so each lands in the same Form 20 filing
 * as its donations. Periods are the same standard quarters (split around any
 * treasurer-defined custom periods, e.g. a pre-election filing) shown on the
 * Filings page — not a fixed calendar-quarter formula, so a fee batch never
 * spans a boundary a custom period already split. Each donation's fee links
 * to the expenditure that recorded it, so re-running never double-counts;
 * deleting a fee expenditure returns its fees to "unrecorded".
 */
export async function recordAnedotFees(
  committeeId: string,
  committeeSlug: string
): Promise<Expenditure[]> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const [rows, committee, customPeriods] = await Promise.all([
    prisma.contribution.findMany({
      where: { committeeId, processingFee: { gt: 0 }, feeExpenditureId: null },
      select: { id: true, date: true, processingFee: true },
    }),
    prisma.committee.findUnique({
      where: { id: committeeId },
      select: { electionYear: true, primaryDate: true, electionDate: true },
    }),
    prisma.customFilingPeriod.findMany({ where: { committeeId } }),
  ])
  const isoDate = (d: Date | null) => d?.toISOString().split('T')[0]
  const periods = mergeFilingPeriods(
    generateQuarterlyPeriods(committee?.electionYear ?? undefined),
    [
      ...generateStatutoryCandidatePeriods({
        primaryDate: isoDate(committee?.primaryDate ?? null),
        electionDate: isoDate(committee?.electionDate ?? null),
      }),
      ...customPeriods.map((p) => ({
        id: p.id,
        label: p.label,
        periodStart: p.periodStart.toISOString().split('T')[0],
        periodEnd: p.periodEnd.toISOString().split('T')[0],
        dueDate: p.dueDate ?? undefined,
      })),
    ]
  )
  const batches = groupFeesByPeriod(
    rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().split('T')[0],
      processingFee: Number(r.processingFee!.toString()),
    })),
    periods
  )
  if (batches.length === 0) return []

  const created: Expenditure[] = []
  for (const batch of batches) {
    const expenditure = await prisma.$transaction(async (tx) => {
      const exp = await tx.expenditure.create({
        data: {
          committeeId,
          amount: batch.total,
          date: new Date(batch.date),
          payee: 'Anedot',
          purpose: `Payment processing fees — ${batch.count} donation${batch.count !== 1 ? 's' : ''} (${seecRange(batch.fromDate, batch.date)})`,
          category: 'BNK',
          method: 'ONLINE', // withheld from deposits → EFT on Form 20
        },
      })
      await tx.contribution.updateMany({
        where: { id: { in: batch.contributionIds }, committeeId },
        data: { feeExpenditureId: exp.id },
      })
      return exp
    })
    created.push(mapExpenditure(expenditure))
  }

  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return created
}

function seecRange(from: string, to: string): string {
  return from === to ? formatShort(from) : `${formatShort(from)} – ${formatShort(to)}`
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}/${y}`
}

export async function deleteExpenditure(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.expenditure.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  await prisma.expenditure.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/expenses`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}
