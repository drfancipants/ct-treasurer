import type { Contribution, Contributor, PaymentMethod } from './types'

// ─── Connecticut contribution limits for town committees ─────────────────────
//
// Sources (verified July 2026):
// - SEEC "Revised Contribution Limits & Restrictions" chart, January 2026:
//   individual → Party Committee (Town) = $2,000 per calendar year.
//   https://seec.ct.gov/Portal/data/pdf/ContributionLimitsChart.pdf
// - CGS § 9-611: no individual contribution in excess of $100 except by
//   personal check or credit card (i.e. cash is capped at $100 per
//   contribution).

/** Max an individual may give a CT town committee per calendar year. */
export const INDIVIDUAL_ANNUAL_LIMIT = 2000

/** A single contribution above this amount may not be made in cash (CGS § 9-611). */
export const CASH_CONTRIBUTION_MAX = 100

/** Fraction of the annual limit at which we start warning. */
export const LIMIT_WARNING_THRESHOLD = 0.8

export type LimitStatus = 'ok' | 'warning' | 'over'

// ─── Donor identity ───────────────────────────────────────────────────────────
// Contributions reference Contributor rows, but the same person can end up as
// several rows (manual entry + Anedot import, or two email addresses). Group
// by lowercased email when present, else by normalized name + ZIP5, so the
// annual total survives duplicate donor records.

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z]/g, '')
}

export function donorKey(c: Pick<Contributor, 'email' | 'firstName' | 'lastName' | 'zip'>): string {
  const email = c.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return `name:${norm(c.firstName)}|${norm(c.lastName)}|${(c.zip ?? '').slice(0, 5)}`
}

// ─── Per-donor calendar-year totals ───────────────────────────────────────────

export interface DonorYearTotal {
  key: string
  /** Display name from the first contribution seen for this donor */
  name: string
  year: number
  total: number
  count: number
  remaining: number
  status: LimitStatus
  /** Distinct contributor row ids in this group — >1 means duplicate donor records */
  contributorIds: string[]
}

function statusFor(total: number): LimitStatus {
  if (total > INDIVIDUAL_ANNUAL_LIMIT) return 'over'
  if (total >= INDIVIDUAL_ANNUAL_LIMIT * LIMIT_WARNING_THRESHOLD) return 'warning'
  return 'ok'
}

export function getDonorYearTotals(contributions: Contribution[]): DonorYearTotal[] {
  const map = new Map<string, DonorYearTotal>()
  for (const c of contributions) {
    const year = parseInt(c.date.slice(0, 4), 10)
    if (isNaN(year)) continue
    const key = `${donorKey(c.contributor)}@${year}`
    let entry = map.get(key)
    if (!entry) {
      entry = {
        key: donorKey(c.contributor),
        name: `${c.contributor.firstName} ${c.contributor.lastName}`.trim(),
        year,
        total: 0,
        count: 0,
        remaining: INDIVIDUAL_ANNUAL_LIMIT,
        status: 'ok',
        contributorIds: [],
      }
      map.set(key, entry)
    }
    entry.total += c.amount
    entry.count += 1
    if (!entry.contributorIds.includes(c.contributor.id)) {
      entry.contributorIds.push(c.contributor.id)
    }
  }
  for (const entry of map.values()) {
    entry.remaining = Math.max(0, INDIVIDUAL_ANNUAL_LIMIT - entry.total)
    entry.status = statusFor(entry.total)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Donors at or above the warning threshold, most exposed first. */
export function getLimitAlerts(contributions: Contribution[], year?: number): DonorYearTotal[] {
  const y = year ?? new Date().getFullYear()
  return getDonorYearTotals(contributions).filter((d) => d.year === y && d.status !== 'ok')
}

// ─── Prospective contribution check (for entry forms / imports) ──────────────

export interface ProspectiveCheck {
  /** Donor's existing total for the contribution's calendar year */
  priorTotal: number
  /** Total if this contribution is accepted */
  newTotal: number
  remaining: number
  status: LimitStatus
  wouldExceed: boolean
  /** Single cash contribution over $100 — prohibited by CGS § 9-611 */
  cashOverMax: boolean
}

export function checkProspective(
  existing: Contribution[],
  donor: Pick<Contributor, 'email' | 'firstName' | 'lastName' | 'zip'>,
  amount: number,
  dateISO: string,
  method?: PaymentMethod
): ProspectiveCheck {
  const year = parseInt(dateISO.slice(0, 4), 10)
  const key = donorKey(donor)
  const priorTotal = getDonorYearTotals(existing)
    .filter((d) => d.key === key && d.year === year)
    .reduce((s, d) => s + d.total, 0)
  const newTotal = priorTotal + amount
  return {
    priorTotal,
    newTotal,
    remaining: Math.max(0, INDIVIDUAL_ANNUAL_LIMIT - newTotal),
    status: statusFor(newTotal),
    wouldExceed: newTotal > INDIVIDUAL_ANNUAL_LIMIT,
    cashOverMax: method === 'CASH' && amount > CASH_CONTRIBUTION_MAX,
  }
}
