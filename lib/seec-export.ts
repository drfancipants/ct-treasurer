import type { Contribution, Expenditure, CommitteeEvent, CommitteeContribution, InKindContribution, Reimbursement } from './types'
import { getSeecStatus } from './types'

// ─── Shared machinery for SEEC eCRIS exports ─────────────────────────────────
// Form 20 (party committees + municipal/probate candidate committees) and
// Form 30 (statewide & General Assembly candidate committees) use the same
// method/purpose code lists and the same per-section preview math; only the
// per-template row layouts differ (those live in form20.ts / form30.ts).

export function yn(b: boolean): string {
  return b ? 'Y' : 'N'
}

/** Method of Contribution codes (Form 20 Section B / Form 30 Section B) */
export const CONTRIBUTION_METHOD: Record<string, string> = {
  CHECK:       'PC',  // Personal Check
  CASH:        'CA',  // Cash
  CREDIT_CARD: 'CD',  // Credit/Debit Card
  DEBIT_CARD:  'CD',  // Credit/Debit Card
  ONLINE:      'CD',  // Treat online as CD (ACH would be separate)
  OTHER:       'PC',  // Default to check
}

/** Method of Payment codes (Form 20 Section P / Form 30 Section N) */
export const EXPENDITURE_METHOD: Record<string, string> = {
  CHECK:       'CH',  // Check
  CASH:        'CH',  // No cash code; CH is closest
  CREDIT_CARD: 'DC',  // Debit Card (credit card charges have their own section)
  DEBIT_CARD:  'DC',  // Debit Card
  ONLINE:      'EFT', // Electronic Funds Transfer
  OTHER:       'CH',
}

/**
 * Purpose of Expenditure. Expenditure.category now stores the SEEC code
 * directly (e.g. "A-RAD"); this map only converts legacy app categories that
 * may survive in old data.
 */
export const LEGACY_EXPENSE_PURPOSE: Record<string, string> = {
  PRINTING:             'PRNT',
  ADVERTISING:          'A-NEWS',
  EVENT:                'FNDR',
  POSTAGE:              'POST',
  OFFICE_SUPPLIES:      'OFFICE',
  TECHNOLOGY:           'WEB',
  PROFESSIONAL_SERVICES:'CNSLT',
  HEADQUARTERS:         'OVHD',
  SIGNAGE:              'A-SIGN',
  OTHER:                'MISC',
}

/** Convert YYYY-MM-DD → mm/dd/yyyy (SEEC required format) */
export function seecDate(iso: string): string {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

export function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

// ─── Preview data (used by the export dialog before generating) ──────────────

export interface FilingPreview {
  itemizedCount: number
  itemizedTotal: number
  nonItemizedCount: number
  nonItemizedTotal: number
  expenditureCount: number
  expenditureTotal: number
  eventCount: number
  eventTotal: number
  committeeContribCount: number
  committeeContribTotal: number
  inKindCount: number
  inKindTotal: number
  reimbursementCount: number
  reimbursementTotal: number
  seecIssues: { contributionId: string; issues: string[] }[]
}

export function previewFiling(
  contributions: Contribution[],
  expenditures: Expenditure[],
  periodStart: string,
  periodEnd: string,
  events: CommitteeEvent[] = [],
  committeeContributions: CommitteeContribution[] = [],
  inKindContributions: InKindContribution[] = [],
  reimbursements: Reimbursement[] = []
): FilingPreview {
  const contribs = contributions.filter((c) => inPeriod(c.date, periodStart, periodEnd))
  const expends  = expenditures.filter((e)  => inPeriod(e.date, periodStart, periodEnd))
  const evts     = events.filter((e)  => inPeriod(e.date, periodStart, periodEnd))
  const cmteC    = committeeContributions.filter((c) => inPeriod(c.date, periodStart, periodEnd))
  const inKind   = inKindContributions.filter((c) => inPeriod(c.date, periodStart, periodEnd))
  const reimbs   = reimbursements.filter((r) => inPeriod(r.date, periodStart, periodEnd))

  const itemized    = contribs.filter((c) =>  c.isItemized)
  const nonItemized = contribs.filter((c) => !c.isItemized)

  const seecIssues = itemized
    .map((c) => ({ contributionId: c.id, issues: getSeecStatus(c).issues }))
    .filter((r) => r.issues.length > 0)

  return {
    itemizedCount:    itemized.length,
    itemizedTotal:    itemized.reduce((s, c) => s + c.amount, 0),
    nonItemizedCount: nonItemized.length,
    nonItemizedTotal: nonItemized.reduce((s, c) => s + c.amount, 0),
    expenditureCount: expends.length,
    expenditureTotal: expends.reduce((s, e) => s + e.amount, 0),
    eventCount: evts.length,
    eventTotal: evts.reduce((s, e) => s + e.foodReceipts + e.tagSaleReceipts, 0),
    committeeContribCount: cmteC.length,
    committeeContribTotal: cmteC.reduce((s, c) => s + c.amount, 0),
    inKindCount: inKind.length,
    inKindTotal: inKind.reduce((s, c) => s + c.fairMarketValue, 0),
    reimbursementCount: reimbs.length,
    reimbursementTotal: reimbs.reduce((s, r) => s + r.amount, 0),
    seecIssues,
  }
}

/**
 * The eCRIS section letters each app record type lands in, per form. Row
 * layouts live in form20.ts / form30.ts (their columns differ per template).
 */
export const FORM_SECTIONS: Record<20 | 30, {
  small: string; itemized: string; committee: string
  events: string; inKind: string; expenses: string; reimbursements: string
}> = {
  20: { small: 'A', itemized: 'B', committee: 'C1', events: 'L1', inKind: 'M', expenses: 'P', reimbursements: 'T' },
  30: { small: 'A', itemized: 'B', committee: 'C1', events: 'J1', inKind: 'K', expenses: 'N', reimbursements: 'R' },
}
