import type { CustomFilingPeriodRecord } from '@/actions/filings'

// ─── Period generation ────────────────────────────────────────────────────────
// Shared between the Filings page (rendering the list) and Anedot fee
// recording (grouping fees into the same periods donations get filed under)
// — both need to agree on where quarters get split around custom periods.

const QUARTER_DEFS = [
  { label: 'Jan 1 – Mar 31', start: '-01-01', end: '-03-31', due: (y: number) => `Apr 10, ${y}` },
  { label: 'Apr 1 – Jun 30', start: '-04-01', end: '-06-30', due: (y: number) => `Jul 10, ${y}` },
  { label: 'Jul 1 – Sep 30', start: '-07-01', end: '-09-30', due: (y: number) => `Oct 10, ${y}` },
  { label: 'Oct 1 – Dec 31', start: '-10-01', end: '-12-31', due: (y: number) => `Jan 10, ${y + 1}` },
]

export interface FilingPeriod {
  label: string
  start: string
  end: string
  due: string
  isCustom?: boolean
  customId?: string
}

export function generateQuarterlyPeriods(electionYear?: number, today: Date = new Date()): FilingPeriod[] {
  const todayStr = today.toISOString().slice(0, 10)
  const currentYear = today.getFullYear()
  const startYear = electionYear ? Math.min(electionYear, currentYear - 1) : currentYear - 1

  const periods: FilingPeriod[] = []
  for (let year = currentYear; year >= startYear; year--) {
    for (let qi = 3; qi >= 0; qi--) {
      const q = QUARTER_DEFS[qi]
      const start = `${year}${q.start}`
      if (start > todayStr) continue
      periods.push({
        label: `Q${qi + 1} ${year} — ${q.label}`,
        start,
        end: `${year}${q.end}`,
        due: q.due(year),
      })
    }
  }
  return periods
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Inserts treasurer-defined custom periods (e.g. a pre-election filing) into
 * the standard quarterly schedule, splitting any quarter a custom period
 * overlaps so the two never double-count the same dates. The split pieces
 * keep the original quarter's due date (SEEC's quarterly deadline doesn't
 * move just because part of it was reported early).
 */
export function mergeFilingPeriods(basePeriods: FilingPeriod[], customPeriods: CustomFilingPeriodRecord[]): FilingPeriod[] {
  let result = basePeriods
  for (const custom of customPeriods) {
    const next: FilingPeriod[] = []
    for (const p of result) {
      if (custom.periodEnd < p.start || custom.periodStart > p.end) {
        next.push(p)
        continue
      }
      const quarterPrefix = p.label.split('—')[0].trim()
      if (p.start < custom.periodStart) {
        const newEnd = addDays(custom.periodStart, -1)
        next.push({
          ...p,
          start: p.start,
          end: newEnd,
          label: `${quarterPrefix} (part) — ${formatShortDate(p.start)} – ${formatShortDate(newEnd)}`,
        })
      }
      if (p.end > custom.periodEnd) {
        const newStart = addDays(custom.periodEnd, 1)
        next.push({
          ...p,
          start: newStart,
          end: p.end,
          label: `${quarterPrefix} (part) — ${formatShortDate(newStart)} – ${formatShortDate(p.end)}`,
        })
      }
    }
    next.push({
      label: custom.label,
      start: custom.periodStart,
      end: custom.periodEnd,
      due: custom.dueDate ?? '—',
      isCustom: true,
      customId: custom.id,
    })
    result = next
  }
  return [...result].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
}
