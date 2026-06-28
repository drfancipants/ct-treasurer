'use server'

import { prisma } from '@/lib/db'

export interface SeecFilingRecord {
  id: string
  periodStart: string
  periodEnd: string
  status: 'DRAFT' | 'READY' | 'FILED' | 'AMENDED'
}

export async function getFilings(committeeId: string): Promise<SeecFilingRecord[]> {
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
