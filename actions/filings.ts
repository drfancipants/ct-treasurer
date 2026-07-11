'use server'

import { revalidatePath } from 'next/cache'
import type { SeecFormType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import { FORM_30_OFFICES } from '@/lib/types'

/**
 * Which SEEC disclosure form a committee files. Statewide & General Assembly
 * candidate committees file Form 30; everyone else (party committees, plus
 * municipal & probate candidates) files Form 20. Derived server-side from the
 * stored committee — never trust a form type from the client.
 */
async function getFormType(committeeId: string): Promise<SeecFormType> {
  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
    select: { type: true, officeSought: true },
  })
  return committee?.type === 'CANDIDATE' &&
    committee.officeSought &&
    FORM_30_OFFICES.includes(committee.officeSought)
    ? 'FORM_30'
    : 'FORM_20'
}

export interface SeecFilingRecord {
  id: string
  periodStart: string
  periodEnd: string
  status: 'DRAFT' | 'READY' | 'FILED' | 'AMENDED'
  beginningBalance?: number
  endingBalance?: number
}

type PrismaFiling = {
  id: string
  periodStart: Date
  periodEnd: Date
  status: string
  beginningBalance: { toString(): string } | null
  endingBalance: { toString(): string } | null
}

function mapFiling(f: PrismaFiling): SeecFilingRecord {
  return {
    id: f.id,
    periodStart: f.periodStart.toISOString().split('T')[0],
    periodEnd: f.periodEnd.toISOString().split('T')[0],
    status: f.status as SeecFilingRecord['status'],
    beginningBalance: f.beginningBalance != null ? Number(f.beginningBalance.toString()) : undefined,
    endingBalance: f.endingBalance != null ? Number(f.endingBalance.toString()) : undefined,
  }
}

export async function markFiled(
  committeeId: string,
  periodStart: string,
  periodEnd: string,
  committeeSlug: string
): Promise<SeecFilingRecord> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const formType = await getFormType(committeeId)

  const filing = await prisma.seecFiling.upsert({
    where: {
      committeeId_formType_periodStart_periodEnd: {
        committeeId,
        formType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    },
    create: {
      committeeId,
      formType,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      status: 'FILED',
      filedAt: new Date(),
    },
    update: {
      status: 'FILED',
      filedAt: new Date(),
    },
  })

  // Stamp every entry in the period as filed. Re-marking (an amendment)
  // re-stamps, so entries added after the original filing pick up the new
  // date; until then they show as not filed — the cue that an amendment
  // is needed.
  const period = { committeeId, date: { gte: new Date(periodStart), lte: new Date(periodEnd) } }
  await prisma.$transaction([
    prisma.contribution.updateMany({ where: period, data: { filedAt: filing.filedAt } }),
    prisma.expenditure.updateMany({ where: period, data: { filedAt: filing.filedAt } }),
    prisma.committeeContribution.updateMany({ where: period, data: { filedAt: filing.filedAt } }),
    prisma.inKindContribution.updateMany({ where: period, data: { filedAt: filing.filedAt } }),
    prisma.reimbursement.updateMany({ where: period, data: { filedAt: filing.filedAt } }),
  ])

  revalidatePath(`/app/${committeeSlug}/filings`)
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/expenses`)
  return mapFiling(filing)
}

export async function getFilings(committeeId: string): Promise<SeecFilingRecord[]> {
  await requireCommitteeMemberById(committeeId)
  const filings = await prisma.seecFiling.findMany({
    where: { committeeId, formType: await getFormType(committeeId) },
    orderBy: { periodStart: 'desc' },
  })
  return filings.map(mapFiling)
}

/**
 * Sets the balance on hand at the start/close of a filing period. Upserts a
 * DRAFT filing row if one doesn't exist yet — balance tracking shouldn't
 * require the period to already be marked filed. Only the fields passed are
 * touched (undefined is skipped by Prisma, so setting just the ending
 * balance doesn't clobber an existing beginning balance).
 */
export async function updateFilingBalance(
  committeeId: string,
  periodStart: string,
  periodEnd: string,
  data: { beginningBalance?: number; endingBalance?: number },
  committeeSlug: string
): Promise<SeecFilingRecord> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const formType = await getFormType(committeeId)

  const filing = await prisma.seecFiling.upsert({
    where: {
      committeeId_formType_periodStart_periodEnd: {
        committeeId,
        formType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    },
    create: {
      committeeId,
      formType,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      status: 'DRAFT',
      beginningBalance: data.beginningBalance,
      endingBalance: data.endingBalance,
    },
    update: {
      beginningBalance: data.beginningBalance,
      endingBalance: data.endingBalance,
    },
  })

  revalidatePath(`/app/${committeeSlug}/filings`)
  return mapFiling(filing)
}

// ─── Custom filing periods ─────────────────────────────────────────────────
// Treasurer-defined periods outside the standard quarterly schedule — e.g. a
// pre-election filing SEEC requires as of some cutoff before Election Day.
// The exact rule varies by election type, so the treasurer supplies the
// period directly rather than the app guessing at a formula.

export interface CustomFilingPeriodRecord {
  id: string
  label: string
  periodStart: string
  periodEnd: string
  dueDate?: string
}

function mapCustomPeriod(p: {
  id: string; label: string; periodStart: Date; periodEnd: Date; dueDate: string | null
}): CustomFilingPeriodRecord {
  return {
    id: p.id,
    label: p.label,
    periodStart: p.periodStart.toISOString().split('T')[0],
    periodEnd: p.periodEnd.toISOString().split('T')[0],
    dueDate: p.dueDate ?? undefined,
  }
}

export async function getCustomFilingPeriods(committeeId: string): Promise<CustomFilingPeriodRecord[]> {
  await requireCommitteeMemberById(committeeId)
  const periods = await prisma.customFilingPeriod.findMany({
    where: { committeeId },
    orderBy: { periodStart: 'desc' },
  })
  return periods.map(mapCustomPeriod)
}

export async function createCustomFilingPeriod(
  committeeId: string,
  data: { label: string; periodStart: string; periodEnd: string; dueDate?: string },
  committeeSlug: string
): Promise<CustomFilingPeriodRecord> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  if (new Date(data.periodEnd) < new Date(data.periodStart)) {
    throw new Error('End date must be on or after the start date')
  }

  const period = await prisma.customFilingPeriod.create({
    data: {
      committeeId,
      label: data.label,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      dueDate: data.dueDate || null,
    },
  })

  revalidatePath(`/app/${committeeSlug}/filings`)
  return mapCustomPeriod(period)
}

export async function deleteCustomFilingPeriod(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.customFilingPeriod.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  await prisma.customFilingPeriod.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/filings`)
}
