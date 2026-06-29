'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMember, requireCommitteeMemberById } from '@/lib/auth'

export interface SeecFilingRecord {
  id: string
  periodStart: string
  periodEnd: string
  status: 'DRAFT' | 'READY' | 'FILED' | 'AMENDED'
}

export async function markFiled(
  committeeId: string,
  periodStart: string,
  periodEnd: string,
  committeeSlug: string
): Promise<SeecFilingRecord> {
  const { committeeId: verifiedId } = await requireCommitteeMember(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const filing = await prisma.seecFiling.upsert({
    where: {
      committeeId_formType_periodStart_periodEnd: {
        committeeId,
        formType: 'FORM_20',
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    },
    create: {
      committeeId,
      formType: 'FORM_20',
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

  revalidatePath(`/app/${committeeSlug}/filings`)
  return {
    id: filing.id,
    periodStart: filing.periodStart.toISOString().split('T')[0],
    periodEnd: filing.periodEnd.toISOString().split('T')[0],
    status: filing.status,
  }
}

export async function getFilings(committeeId: string): Promise<SeecFilingRecord[]> {
  await requireCommitteeMemberById(committeeId)
  const filings = await prisma.seecFiling.findMany({
    where: { committeeId, formType: 'FORM_20' },
    orderBy: { periodStart: 'desc' },
  })
  return filings.map((f) => ({
    id: f.id,
    periodStart: f.periodStart.toISOString().split('T')[0],
    periodEnd: f.periodEnd.toISOString().split('T')[0],
    status: f.status,
  }))
}
