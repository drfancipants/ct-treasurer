/**
 * Anedot deducts its processing fee before depositing (the net amount is what
 * hits the bank), but SEEC reporting needs the full donation as the
 * contribution and the fees as an expenditure. These helpers batch unrecorded
 * fees into one expenditure per calendar quarter so each lands in the same
 * Form 20 filing period as its donations.
 */

export interface FeeContribution {
  id: string
  /** YYYY-MM-DD */
  date: string
  processingFee: number
}

export interface FeeBatch {
  /** e.g. "2026-Q2" */
  quarter: string
  contributionIds: string[]
  total: number
  count: number
  /** Latest donation date in the batch — the expenditure date (YYYY-MM-DD) */
  date: string
  /** Earliest donation date in the batch (YYYY-MM-DD) */
  fromDate: string
}

function quarterOf(date: string): string {
  const month = Number(date.slice(5, 7))
  return `${date.slice(0, 4)}-Q${Math.ceil(month / 3)}`
}

export function groupFeesByQuarter(rows: FeeContribution[]): FeeBatch[] {
  const byQuarter = new Map<string, FeeContribution[]>()
  for (const r of rows) {
    if (!(r.processingFee > 0) || !r.date) continue
    const q = quarterOf(r.date)
    byQuarter.set(q, [...(byQuarter.get(q) ?? []), r])
  }

  return [...byQuarter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, group]) => {
      const dates = group.map((g) => g.date).sort()
      return {
        quarter,
        contributionIds: group.map((g) => g.id),
        total: Math.round(group.reduce((s, g) => s + g.processingFee, 0) * 100) / 100,
        count: group.length,
        date: dates[dates.length - 1],
        fromDate: dates[0],
      }
    })
}
