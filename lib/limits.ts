import type { Committee, Contribution, Contributor, OfficeSought, PaymentMethod } from './types'

// ─── Connecticut contribution limits ─────────────────────────────────────────
//
// Sources (verified July 2026):
// - SEEC "Revised Contribution Limits & Restrictions" chart, January 2026:
//   https://seec.ct.gov/Portal/data/pdf/ContributionLimitsChart.pdf
//   · individual → Party Committee (Town) = $2,000 per calendar year
//   · individual → candidate committee = office-based limit, applied
//     SEPARATELY to the primary and the election (chart footnote 2):
//     contributions received on or before primary day count toward the
//     primary; after it, toward the election. The separate primary limit
//     only exists when the candidate competes in a primary.
//   · CEP participants (chart footnote 3): individuals only, $5–$340 for
//     the 2026 cycle (CPI-adjusted per cycle), aggregated per donor over
//     the whole cycle; ALL committee/party/PAC money is prohibited, as are
//     state-contractor contributions.
// - CGS § 9-611: no individual contribution in excess of $100 except by
//   personal check or credit card (i.e. cash is capped at $100 per
//   contribution) — statute-wide, applies to every committee type.
//
// Everything here is pure: aggregation walks Contribution[] under a
// LimitPolicy derived from the committee. Party-committee call sites can
// omit the policy (it defaults to PARTY_POLICY), which keeps that behavior
// byte-for-byte identical to the original single-limit implementation.

/** Max an individual may give a CT town committee per calendar year. */
export const INDIVIDUAL_ANNUAL_LIMIT = 2000

/** A single contribution above this amount may not be made in cash (CGS § 9-611). */
export const CASH_CONTRIBUTION_MAX = 100

/** Fraction of the limit at which we start warning. */
export const LIMIT_WARNING_THRESHOLD = 0.8

/** Individual → candidate-committee limits by office sought (non-CEP), per phase. */
export const OFFICE_INDIVIDUAL_LIMITS: Record<OfficeSought, number> = {
  GOVERNOR: 3500,
  STATEWIDE: 2000,
  STATE_SENATOR: 1000,
  PROBATE_JUDGE: 1000,
  CHIEF_EXECUTIVE: 1000,
  STATE_REPRESENTATIVE: 250,
  OTHER_MUNICIPAL: 250,
}

/**
 * CEP qualifying-contribution bounds per election cycle. CPI-adjusted by SEEC
 * (quadrennially for statewide, biennially for General Assembly) — ADD A ROW
 * FOR EACH NEW CYCLE. Unknown cycles fall back to the latest entry.
 */
export const CEP_CYCLE_LIMITS: Record<number, { min: number; max: number }> = {
  2022: { min: 5, max: 290 },
  2024: { min: 5, max: 320 },
  2026: { min: 5, max: 340 },
}

export type LimitStatus = 'ok' | 'warning' | 'over'

// ─── Limit policy ─────────────────────────────────────────────────────────────

export type PolicyKind = 'PARTY' | 'CANDIDATE' | 'CANDIDATE_CEP'

export interface LimitPolicy {
  kind: PolicyKind
  /** Max an individual may give per aggregation bucket */
  individualLimit: number
  /** CEP qualifying-contribution minimum — sub-minimum gifts warn, they don't violate */
  cepMin?: number
  /** ISO primary date — presence splits candidate aggregation into primary/election phases */
  primaryDate?: string
  /** CEP: any contribution from another committee is a prohibited source */
  committeeSourceProhibited: boolean
  /** CEP: contributions from state contractors are prohibited */
  stateContractorProhibited: boolean
  /** Human copy, e.g. "$2,000 per calendar year" / "$250 per primary and per election" */
  limitLabel: string
  /** Noun for "$X/<noun> limit" prose: year (party) / primary / election / cycle */
  perBucketNoun?: string
}

export const PARTY_POLICY: LimitPolicy = {
  kind: 'PARTY',
  individualLimit: INDIVIDUAL_ANNUAL_LIMIT,
  committeeSourceProhibited: false,
  stateContractorProhibited: false,
  limitLabel: `$${INDIVIDUAL_ANNUAL_LIMIT.toLocaleString()} per calendar year`,
}

function cepLimitsForCycle(cycleYear: number | undefined): { min: number; max: number } {
  if (cycleYear && CEP_CYCLE_LIMITS[cycleYear]) return CEP_CYCLE_LIMITS[cycleYear]
  const latest = Math.max(...Object.keys(CEP_CYCLE_LIMITS).map(Number))
  return CEP_CYCLE_LIMITS[latest]
}

/** Derive the limit rules for a committee. Serializable — safe to pass to client components. */
export function getLimitPolicy(
  committee: Pick<Committee, 'type' | 'officeSought' | 'cepParticipant' | 'primaryDate' | 'electionDate' | 'electionYear'>
): LimitPolicy {
  if (committee.type !== 'CANDIDATE') return PARTY_POLICY

  if (committee.cepParticipant) {
    const cycleYear =
      (committee.electionDate ? parseInt(committee.electionDate.slice(0, 4), 10) : undefined) ??
      committee.electionYear
    const { min, max } = cepLimitsForCycle(cycleYear)
    return {
      kind: 'CANDIDATE_CEP',
      individualLimit: max,
      cepMin: min,
      committeeSourceProhibited: true,
      stateContractorProhibited: true,
      limitLabel: `$${max.toLocaleString()} per election cycle (CEP)`,
      perBucketNoun: 'cycle',
    }
  }

  const limit = committee.officeSought ? OFFICE_INDIVIDUAL_LIMITS[committee.officeSought] : INDIVIDUAL_ANNUAL_LIMIT
  return {
    kind: 'CANDIDATE',
    individualLimit: limit,
    primaryDate: committee.primaryDate,
    committeeSourceProhibited: false,
    stateContractorProhibited: false,
    limitLabel: committee.primaryDate
      ? `$${limit.toLocaleString()} per primary and per election`
      : `$${limit.toLocaleString()} per election`,
  }
}

/**
 * Aggregation bucket for a contribution date:
 * PARTY → the calendar year ('2026'); CANDIDATE with a primary → 'PRIMARY'
 * (on or before primary day) or 'ELECTION'; CANDIDATE without → 'ELECTION';
 * CEP → one 'CYCLE' bucket (the cap spans the whole campaign).
 */
export function bucketFor(policy: LimitPolicy, dateISO: string): string {
  if (policy.kind === 'PARTY') return dateISO.slice(0, 4)
  if (policy.kind === 'CANDIDATE_CEP') return 'CYCLE'
  return policy.primaryDate && dateISO.slice(0, 10) <= policy.primaryDate ? 'PRIMARY' : 'ELECTION'
}

/** Short display label for a bucket: '2026' / 'Primary' / 'Election' / 'Cycle'. */
export function bucketLabel(policy: LimitPolicy, bucket: string): string {
  if (policy.kind === 'PARTY') return bucket
  return bucket.charAt(0) + bucket.slice(1).toLowerCase()
}

/** Prose form for messages: 'for 2026' / 'for the primary' / 'for the cycle'. */
function bucketProse(policy: LimitPolicy, bucket: string): string {
  return policy.kind === 'PARTY' ? bucket : `the ${bucket.toLowerCase()}`
}

/** Noun for "$X/<noun> limit" prose. */
function limitNoun(policy: LimitPolicy, bucket: string): string {
  if (policy.kind === 'PARTY') return 'year'
  if (policy.kind === 'CANDIDATE_CEP') return 'cycle'
  return bucket.toLowerCase()
}

// ─── Donor identity ───────────────────────────────────────────────────────────
// Contributions reference Contributor rows, but the same person can end up as
// several rows (manual entry + Anedot import, or two email addresses). Group
// by lowercased email when present, else by normalized name + ZIP5, so the
// bucket total survives duplicate donor records.

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z]/g, '')
}

export function donorKey(c: Pick<Contributor, 'email' | 'firstName' | 'lastName' | 'zip'>): string {
  const email = c.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return `name:${norm(c.firstName)}|${norm(c.lastName)}|${(c.zip ?? '').slice(0, 5)}`
}

// ─── Per-donor per-bucket totals ──────────────────────────────────────────────

export interface DonorTotal {
  key: string
  /** Display name from the first contribution seen for this donor */
  name: string
  /** Aggregation bucket id — a year for party committees, PRIMARY/ELECTION/CYCLE for candidates */
  bucket: string
  /** Display label for the bucket ('2026', 'Primary', …) */
  bucketLabel: string
  /** Calendar year — only set under the party policy */
  year?: number
  total: number
  count: number
  remaining: number
  status: LimitStatus
  /** Distinct contributor row ids in this group — >1 means duplicate donor records */
  contributorIds: string[]
}

/** @deprecated old name — party-policy results always have `year` set */
export type DonorYearTotal = DonorTotal

function statusFor(total: number, limit: number): LimitStatus {
  if (total > limit) return 'over'
  if (total >= limit * LIMIT_WARNING_THRESHOLD) return 'warning'
  return 'ok'
}

export function getDonorYearTotals(contributions: Contribution[], policy: LimitPolicy = PARTY_POLICY): DonorTotal[] {
  const map = new Map<string, DonorTotal>()
  for (const c of contributions) {
    const bucket = bucketFor(policy, c.date)
    if (policy.kind === 'PARTY' && isNaN(parseInt(bucket, 10))) continue
    const key = `${donorKey(c.contributor)}@${bucket}`
    let entry = map.get(key)
    if (!entry) {
      entry = {
        key: donorKey(c.contributor),
        name: `${c.contributor.firstName} ${c.contributor.lastName}`.trim(),
        bucket,
        bucketLabel: bucketLabel(policy, bucket),
        year: policy.kind === 'PARTY' ? parseInt(bucket, 10) : undefined,
        total: 0,
        count: 0,
        remaining: policy.individualLimit,
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
    entry.remaining = Math.max(0, policy.individualLimit - entry.total)
    entry.status = statusFor(entry.total, policy.individualLimit)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/**
 * Donors at or above the warning threshold, most exposed first. Party policy:
 * scoped to one calendar year (default: the current one). Candidate policies:
 * every phase is live during the cycle, so all non-ok buckets are returned.
 */
export function getLimitAlerts(
  contributions: Contribution[],
  year?: number,
  policy: LimitPolicy = PARTY_POLICY
): DonorTotal[] {
  const totals = getDonorYearTotals(contributions, policy)
  if (policy.kind !== 'PARTY') return totals.filter((d) => d.status !== 'ok')
  const y = year ?? new Date().getFullYear()
  return totals.filter((d) => d.year === y && d.status !== 'ok')
}

// ─── Recorded-contribution violations ─────────────────────────────────────────

/**
 * Flags recorded contributions that violate SEEC rules, by contribution id:
 * - a single cash contribution over $100 (CGS § 9-611)
 * - contributions that put a donor past the policy's individual limit —
 *   each donor-bucket is walked in date order and every contribution from the
 *   crossing point on is flagged, so early legitimate gifts stay clean.
 *   (Note: refunds are recorded as REF expenditures, not negative
 *   contributions, so a refunded excess still shows as flagged.)
 * - CEP participants only: contributions from state contractors.
 *
 * These are violations of the law, distinct from getSeecStatus()'s
 * missing-paperwork statuses; the prospective checks in checkProspective()
 * warn at entry time, but imports, edits, and warnings the user clicked
 * through can still land violating rows — this catches them after the fact.
 */
export function getContributionViolations(
  contributions: Contribution[],
  policy: LimitPolicy = PARTY_POLICY
): Map<string, string[]> {
  const violations = new Map<string, string[]>()
  const add = (id: string, message: string) => {
    violations.set(id, [...(violations.get(id) ?? []), message])
  }

  for (const c of contributions) {
    if (c.method === 'CASH' && c.amount > CASH_CONTRIBUTION_MAX) {
      add(c.id, `Cash contribution over $${CASH_CONTRIBUTION_MAX} (CGS § 9-611)`)
    }
    if (policy.stateContractorProhibited && c.isStateContractor) {
      add(c.id, 'State contractor contributions are prohibited for CEP participants')
    }
  }

  const groups = new Map<string, Contribution[]>()
  for (const c of contributions) {
    const key = `${donorKey(c.contributor)}@${bucketFor(policy, c.date)}`
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  for (const [key, group] of groups) {
    const bucket = key.slice(key.lastIndexOf('@') + 1)
    const ordered = [...group].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    )
    let running = 0
    for (const c of ordered) {
      running += c.amount
      if (running > policy.individualLimit) {
        add(
          c.id,
          `Puts donor over the $${policy.individualLimit.toLocaleString()}/${limitNoun(policy, bucket)} limit ` +
            `($${running.toLocaleString()} total for ${bucketProse(policy, bucket)})`
        )
      }
    }
  }

  return violations
}

/**
 * Advisory (non-violation) flags by contribution id. Currently: CEP gifts
 * below the qualifying minimum — legal to accept, but they don't count toward
 * the qualifying threshold, so treasurers usually want to know.
 */
export function getContributionWarnings(
  contributions: Contribution[],
  policy: LimitPolicy = PARTY_POLICY
): Map<string, string[]> {
  const warnings = new Map<string, string[]>()
  if (policy.cepMin == null) return warnings
  for (const c of contributions) {
    if (c.amount > 0 && c.amount < policy.cepMin) {
      warnings.set(c.id, [
        `Below the $${policy.cepMin} CEP qualifying minimum — won't count toward qualifying funds`,
      ])
    }
  }
  return warnings
}

/** Banner message for the committee-contributions view, or null when they're allowed. */
export function getCommitteeSourceViolation(policy: LimitPolicy): string | null {
  return policy.committeeSourceProhibited
    ? 'Citizens’ Election Program participants may not accept contributions from committees (party, PAC, or candidate).'
    : null
}

// ─── Prospective contribution check (for entry forms / imports) ──────────────

export interface ProspectiveCheck {
  /** Donor's existing total for the contribution's aggregation bucket */
  priorTotal: number
  /** Total if this contribution is accepted */
  newTotal: number
  remaining: number
  status: LimitStatus
  wouldExceed: boolean
  /** Single cash contribution over $100 — prohibited by CGS § 9-611 */
  cashOverMax: boolean
  /** The applicable per-bucket limit and its human description */
  limit: number
  limitLabel: string
  /** Which bucket this contribution counts toward ('2026', 'Primary', …) */
  bucketLabel: string
  /** CEP only: below the qualifying minimum (advisory, not a violation) */
  cepBelowMin: boolean
}

export function checkProspective(
  existing: Contribution[],
  donor: Pick<Contributor, 'email' | 'firstName' | 'lastName' | 'zip'>,
  amount: number,
  dateISO: string,
  method?: PaymentMethod,
  policy: LimitPolicy = PARTY_POLICY
): ProspectiveCheck {
  const bucket = bucketFor(policy, dateISO)
  const key = donorKey(donor)
  const priorTotal = getDonorYearTotals(existing, policy)
    .filter((d) => d.key === key && d.bucket === bucket)
    .reduce((s, d) => s + d.total, 0)
  const newTotal = priorTotal + amount
  return {
    priorTotal,
    newTotal,
    remaining: Math.max(0, policy.individualLimit - newTotal),
    status: statusFor(newTotal, policy.individualLimit),
    wouldExceed: newTotal > policy.individualLimit,
    cashOverMax: method === 'CASH' && amount > CASH_CONTRIBUTION_MAX,
    limit: policy.individualLimit,
    limitLabel: policy.limitLabel,
    bucketLabel: bucketLabel(policy, bucket),
    cepBelowMin: policy.cepMin != null && amount > 0 && amount < policy.cepMin,
  }
}

// ─── Running batch checker (CSV imports) ──────────────────────────────────────

/**
 * Stateful checker that accumulates a batch on top of existing history, so a
 * file of small donations that collectively cross a limit still gets flagged
 * from the crossing row on. Returns human-readable issues per row.
 */
export function createRunningLimitChecker(
  existing: Contribution[],
  policy: LimitPolicy = PARTY_POLICY
): (
  donor: Pick<Contributor, 'email' | 'firstName' | 'lastName' | 'zip'>,
  amount: number,
  dateISO: string,
  method?: PaymentMethod
) => string[] {
  const totals = new Map<string, number>()
  for (const d of getDonorYearTotals(existing, policy)) {
    totals.set(`${d.key}@${d.bucket}`, d.total)
  }
  return (donor, amount, dateISO, method) => {
    const issues: string[] = []
    const bucket = bucketFor(policy, dateISO)
    const key = `${donorKey(donor)}@${bucket}`
    const newTotal = (totals.get(key) ?? 0) + amount
    if (newTotal > policy.individualLimit) {
      const noun = policy.kind === 'PARTY' ? 'annual' : `${limitNoun(policy, bucket)}`
      issues.push(
        `Donor reaches $${newTotal.toLocaleString()} for ${bucketProse(policy, bucket)} — ` +
          `over the $${policy.individualLimit.toLocaleString()} ${noun} limit`
      )
    }
    if (method === 'CASH' && amount > CASH_CONTRIBUTION_MAX) {
      issues.push(`Cash contribution over $${CASH_CONTRIBUTION_MAX} (CGS § 9-611)`)
    }
    if (policy.cepMin != null && amount > 0 && amount < policy.cepMin) {
      issues.push(`Below the $${policy.cepMin} CEP qualifying minimum — won't count toward qualifying funds`)
    }
    totals.set(key, newTotal)
    return issues
  }
}
