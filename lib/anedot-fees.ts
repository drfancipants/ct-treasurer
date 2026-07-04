import type { FilingPeriod } from './filing-periods'

/**
 * Anedot deducts its processing fee before depositing (the net amount is what
 * hits the bank), but SEEC reporting needs the full donation as the
 * contribution and the fees as an expenditure. These helpers batch unrecorded
 * fees into one expenditure per filing period (standard quarters, split
 * around any custom periods, and the custom periods themselves) so each
 * lands in the same Form 20 filing as its donations.
 */

export interface FeeContribution {
  id: string
  /** YYYY-MM-DD */
  date: string
  processingFee: number
}

export interface FeeBatch {
  /** The filing period this batch's donations fall in — a quarter label, a split "(part)" label, or a custom period's label */
  periodLabel: string
  periodStart: string
  periodEnd: string
  contributionIds: string[]
  total: number
  count: number
  /** Latest donation date in the batch — the expenditure date (YYYY-MM-DD) */
  date: string
  /** Earliest donation date in the batch (YYYY-MM-DD) */
  fromDate: string
}

/** Calendar-quarter fallback for a date that (unexpectedly) doesn't fall in any of the supplied periods */
function quarterOf(date: string): { label: string; start: string; end: string } {
  const year = date.slice(0, 4)
  const month = Number(date.slice(5, 7))
  const q = Math.ceil(month / 3)
  const startMonth = String((q - 1) * 3 + 1).padStart(2, '0')
  const endMonth = String(q * 3).padStart(2, '0')
  const endDay = q === 1 || q === 4 ? '31' : '30'
  return { label: `${year}-Q${q}`, start: `${year}-${startMonth}-01`, end: `${year}-${endMonth}-${endDay}` }
}

export function groupFeesByPeriod(rows: FeeContribution[], periods: FilingPeriod[]): FeeBatch[] {
  const byPeriod = new Map<string, { start: string; end: string; label: string; rows: FeeContribution[] }>()
  for (const r of rows) {
    if (!(r.processingFee > 0) || !r.date) continue
    const match = periods.find((p) => r.date >= p.start && r.date <= p.end)
    const key = match ? `${match.start}_${match.end}` : `fallback_${quarterOf(r.date).label}`
    const existing = byPeriod.get(key)
    if (existing) {
      existing.rows.push(r)
    } else {
      const fallback = match ? null : quarterOf(r.date)
      byPeriod.set(key, {
        start: match?.start ?? fallback!.start,
        end: match?.end ?? fallback!.end,
        label: match?.label ?? fallback!.label,
        rows: [r],
      })
    }
  }

  return [...byPeriod.values()]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(({ start, end, label, rows: group }) => {
      const dates = group.map((g) => g.date).sort()
      return {
        periodLabel: label,
        periodStart: start,
        periodEnd: end,
        contributionIds: group.map((g) => g.id),
        total: Math.round(group.reduce((s, g) => s + g.processingFee, 0) * 100) / 100,
        count: group.length,
        date: dates[dates.length - 1],
        fromDate: dates[0],
      }
    })
}
