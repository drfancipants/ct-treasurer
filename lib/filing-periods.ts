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
  /** Statutory candidate-committee statement (pre-primary / post-primary / pre-election) — not deletable */
  isStatutory?: boolean
}

/**
 * Anything mergeFilingPeriods can splice into the quarterly schedule:
 * treasurer-defined CustomFilingPeriodRecords satisfy this structurally, and
 * generateStatutoryCandidatePeriods() produces id-less statutory entries.
 */
export interface SpliceablePeriod {
  id?: string
  label: string
  periodStart: string
  periodEnd: string
  dueDate?: string
  isStatutory?: boolean
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

function formatDueDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * The statutory candidate-committee statements beyond the quarterlies
 * (CGS § 9-608): due the 7th day preceding a primary/election and the 30th
 * day following a primary, each complete through 11:59 p.m. of the 2nd day
 * preceding its filing day. Returned as spliceable periods so
 * mergeFilingPeriods() carves them out of the quarterly schedule exactly like
 * treasurer-defined custom periods.
 *
 * Each period's coverage starts at the later of (a) the day after the previous
 * statutory period's end and (b) the first day of the quarter containing its
 * own end — because any intervening quarterly statement resets coverage.
 *
 * Party committees (no primary/election dates) get an empty array. Periods
 * that haven't started yet relative to `today` are omitted, matching
 * generateQuarterlyPeriods.
 */
export function generateStatutoryCandidatePeriods(
  committee: { primaryDate?: string; electionDate?: string },
  today: Date = new Date()
): SpliceablePeriod[] {
  const todayStr = today.toISOString().slice(0, 10)
  const events: { name: string; due: string }[] = []
  if (committee.primaryDate) {
    events.push({ name: 'Pre-primary', due: addDays(committee.primaryDate, -7) })
    events.push({ name: 'Post-primary', due: addDays(committee.primaryDate, 30) })
  }
  if (committee.electionDate) {
    events.push({ name: 'Pre-election', due: addDays(committee.electionDate, -7) })
  }
  events.sort((a, b) => a.due.localeCompare(b.due))

  const periods: SpliceablePeriod[] = []
  let prevEnd: string | undefined
  for (const ev of events) {
    const end = addDays(ev.due, -2)
    const quarterStart = `${end.slice(0, 5)}${['01-01', '04-01', '07-01', '10-01'][Math.floor((parseInt(end.slice(5, 7), 10) - 1) / 3)]}`
    const start = prevEnd && addDays(prevEnd, 1) > quarterStart ? addDays(prevEnd, 1) : quarterStart
    prevEnd = end
    if (start > todayStr || start > end) continue
    periods.push({
      label: `${ev.name} — ${formatShortDate(start)} – ${formatShortDate(end)}`,
      periodStart: start,
      periodEnd: end,
      dueDate: formatDueDate(ev.due),
      isStatutory: true,
    })
  }
  return periods
}

/**
 * Inserts treasurer-defined custom periods (e.g. a pre-election filing) into
 * the standard quarterly schedule, splitting any quarter a custom period
 * overlaps so the two never double-count the same dates. The split pieces
 * keep the original quarter's due date (SEEC's quarterly deadline doesn't
 * move just because part of it was reported early).
 */
export function mergeFilingPeriods(basePeriods: FilingPeriod[], customPeriods: SpliceablePeriod[]): FilingPeriod[] {
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
      isCustom: !custom.isStatutory,
      customId: custom.id,
      isStatutory: custom.isStatutory,
    })
    result = next
  }
  return [...result].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
}
