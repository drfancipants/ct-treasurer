import * as XLSX from 'xlsx'
import type { Contribution, Expenditure, CommitteeEvent, CommitteeContribution, InKindContribution, Reimbursement } from './types'
import { getSeecStatus } from './types'

function yn(b: boolean): string {
  return b ? 'Y' : 'N'
}

// ─── SEEC eCRIS code mappings (from the Code List sheet) ─────────────────────

/** Section B – Method of Contribution codes */
const CONTRIBUTION_METHOD: Record<string, string> = {
  CHECK:       'PC',  // Personal Check
  CASH:        'CA',  // Cash
  CREDIT_CARD: 'CD',  // Credit/Debit Card
  DEBIT_CARD:  'CD',  // Credit/Debit Card
  ONLINE:      'CD',  // Treat online as CD (ACH would be separate)
  OTHER:       'PC',  // Default to check
}

/** Section P – Method of Payment codes (different from Section B) */
const EXPENDITURE_METHOD: Record<string, string> = {
  CHECK:       'CH',  // Check
  CASH:        'CH',  // No cash code in Section P; CH is closest
  CREDIT_CARD: 'DC',  // Debit Card (credit card charges go in Section R)
  DEBIT_CARD:  'DC',  // Debit Card
  ONLINE:      'EFT', // Electronic Funds Transfer
  OTHER:       'CH',
}

/**
 * Section P – Purpose of Expenditure. Expenditure.category now stores the
 * SEEC code directly (e.g. "A-RAD"); this map only converts legacy app
 * categories that may survive in old data.
 */
const LEGACY_EXPENSE_PURPOSE: Record<string, string> = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert YYYY-MM-DD → mm/dd/yyyy (SEEC required format) */
function seecDate(iso: string): string {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

// ─── Main export function ─────────────────────────────────────────────────────

/**
 * Loads the official eCRIS Form 20 template, populates Sections A, B, and P
 * with the supplied data, and returns the modified workbook as a Uint8Array
 * ready for download as an .xls file.
 */
export function populateForm20(
  templateBuffer: ArrayBuffer,
  contributions: Contribution[],
  expenditures: Expenditure[],
  periodStart: string,
  periodEnd: string,
  events: CommitteeEvent[] = [],
  committeeContributions: CommitteeContribution[] = [],
  inKindContributions: InKindContribution[] = [],
  reimbursements: Reimbursement[] = []
): Uint8Array {
  const wb = XLSX.read(new Uint8Array(templateBuffer), { type: 'array' })

  const contribs = contributions.filter((c) => inPeriod(c.date, periodStart, periodEnd))
  const expends  = expenditures.filter((e)  => inPeriod(e.date, periodStart, periodEnd))
  const evts     = events.filter((e)  => inPeriod(e.date, periodStart, periodEnd))
  const cmteC    = committeeContributions.filter((c) => inPeriod(c.date, periodStart, periodEnd))
  const inKind   = inKindContributions.filter((c) => inPeriod(c.date, periodStart, periodEnd))
  const reimbs   = reimbursements.filter((r) => inPeriod(r.date, periodStart, periodEnd))

  // Look up a linked event's date + letter for the Section B / P / C1 / M event columns
  const eventById = new Map(events.map((e) => [e.id, e]))

  const itemized    = contribs.filter((c) => c.isItemized)
  const nonItemized = contribs.filter((c) => !c.isItemized)
  const smallTotal  = nonItemized.reduce((s, c) => s + c.amount, 0)

  // ── Section A: aggregate small-contributor total ─────────────────────────
  {
    const ws = wb.Sheets['Section A']
    if (ws && smallTotal > 0) {
      XLSX.utils.sheet_add_aoa(ws, [[smallTotal]], { origin: 'A2' })
    }
  }

  // ── Section C1: contributions from other committees ──────────────────────
  {
    const ws = wb.Sheets['Section C1']
    if (ws && cmteC.length > 0) {
      const rows = cmteC.map((c, i) => [
        i + 1,                                            //  0 Transaction ID
        c.fromName,                                       //  1 Name of Committee
        c.treasurerName ?? '',                            //  2 Name of Treasurer
        c.street ?? '',                                   //  3 Committee Street Address
        c.city ?? '',                                     //  4 City
        c.state,                                          //  5 State
        c.zip ?? '',                                      //  6 Zip
        seecDate(c.date),                                 //  7 Date Received
        c.amount,                                         //  8 Amount
        c.eventId && eventById.has(c.eventId) ? 'Y' : 'N',            //  9 Associated with an L1 event?
        c.eventId ? seecDate(eventById.get(c.eventId)?.date ?? '') : '', // 10 Event date
        c.eventId ? eventById.get(c.eventId)?.letter ?? '' : '',      // 11 Event letter
        '',                                               // 12 Aggregate correction
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section B: itemized individual contributions ──────────────────────────
  {
    const ws = wb.Sheets['Section B']
    if (ws && itemized.length > 0) {
      const rows = itemized.map((c, i) => [
        i + 1,                                            //  0 Transaction ID
        c.contributor.lastName,                           //  1 Last Name
        c.contributor.firstName,                          //  2 First Name
        c.contributor.middleInitial ?? '',                //  3 Middle Initials
        c.contributor.address1,                           //  4 Street Address
        c.contributor.city,                               //  5 City
        c.contributor.state,                              //  6 State
        c.contributor.zip,                                //  7 Zip
        c.contributor.employer  ?? '',                    //  8 Employer
        c.contributor.occupation ?? '',                   //  9 Occupation
        seecDate(c.date),                                 // 10 Date Received
        c.amount,                                         // 11 Amount
        CONTRIBUTION_METHOD[c.method] ?? 'PC',            // 12 Method code
        c.isStateContractor ? 'Y' : 'N',                  // 13 State contractor?
        c.isStateContractor ? (c.contractorBranch ?? '') : '', // 14 Which branch?
        c.eventId && eventById.has(c.eventId) ? 'Y' : 'N',            // 15 Associated with an L1 event?
        c.eventId ? seecDate(eventById.get(c.eventId)?.date ?? '') : '', // 16 Event date
        c.eventId ? eventById.get(c.eventId)?.letter ?? '' : '',      // 17 Event letter
        c.isLobbyist ? 'Y' : 'N',                         // 18 Lobbyist?
        'N',                                              // 19 Municipality contract?
        '',                                               // 20 Aggregate correction
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section P: expenses paid by committee ─────────────────────────────────
  {
    const ws = wb.Sheets['Section P']
    if (ws && expends.length > 0) {
      const rows = expends.map((e, i) => [
        i + 1,                                            //  0 Transaction ID
        e.payee,                                          //  1 Payee Name
        e.payeeAddress1 ?? '',                            //  2 Street Address (optional)
        e.payeeCity ?? '',                                //  3 City
        e.payeeState ?? '',                                //  4 State
        e.payeeZip ?? '',                                 //  5 Zip
        seecDate(e.date),                                 //  6 Date of Payment
        e.amount,                                         //  7 Amount
        EXPENDITURE_METHOD[e.method] ?? 'CH',             //  8 Method code
        e.checkNumber ?? '',                              //  9 Check number
        e.purpose,                                        // 10 Description
        e.eventId ? seecDate(eventById.get(e.eventId)?.date ?? '') : '', // 11 Event date
        e.eventId ? eventById.get(e.eventId)?.letter ?? '' : '',      // 12 Event letter
        i + 1,                                            // 13 Expenditure number
        'NONE',                                           // 14 Type (NONE = not coordinated)
        LEGACY_EXPENSE_PURPOSE[e.category] ?? e.category, // 15 Purpose code (stored directly)
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section L1: fundraising / event information ───────────────────────────
  {
    const ws = wb.Sheets['Section L1']
    if (ws && evts.length > 0) {
      const rows = evts.map((e, i) => [
        i + 1,                          //  0 Transaction ID
        seecDate(e.date),               //  1 Date of Event
        e.letter,                       //  2 Letter for Event#
        e.description,                  //  3 Event Description
        yn(e.isFundraiser),             //  4 Was this a fundraising event?
        e.street ?? '',                 //  5 Street Address
        e.city ?? '',                   //  6 City
        e.state,                        //  7 State
        e.zip ?? '',                    //  8 Zip
        yn(e.isPersonalResidence),      //  9 Hosted at a personal residence?
        yn(e.hadDonatedGoods),          // 10 Included donated goods/services?
        yn(e.wasTagSale),               // 11 Tag sale / auction?
        yn(e.hadProgramBook),           // 12 Program-book advertising?
        yn(e.soldFoodAtFair),           // 13 Sold food/beverage at a fair?
        e.foodReceipts,                 // 14 Total Receipts Food
        e.tagSaleReceipts,              // 15 Total Receipts TagSale
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section M: in-kind contributions ──────────────────────────────────────
  {
    const ws = wb.Sheets['Section M']
    if (ws && inKind.length > 0) {
      const rows = inKind.map((c, i) => [
        i + 1,                                            //  0 Transaction ID
        c.lastName,                                       //  1 Last Name / entity name
        c.firstName ?? '',                                //  2 First Name
        c.middleInitial ?? '',                            //  3 Middle Initials
        c.entityName ?? '',                               //  4 Name of Committee
        c.street ?? '',                                   //  5 Street Address
        c.city ?? '',                                     //  6 City
        c.state,                                          //  7 State
        c.zip ?? '',                                      //  8 Zip
        seecDate(c.date),                                 //  9 Date Received
        c.fairMarketValue,                                // 10 Fair Market Value
        c.entityType,                                     // 11 Entity Type (IS/CO/OT)
        c.description,                                    // 12 Description
        yn(c.isStateContractorPrincipal),                // 13 State contractor principal?
        c.isStateContractorPrincipal ? (c.contractorBranch ?? '') : '', // 14 Branch (E/L/B)
        c.eventId && eventById.has(c.eventId) ? 'Y' : 'N',            // 15 Associated with an L1 event?
        c.eventId ? seecDate(eventById.get(c.eventId)?.date ?? '') : '', // 16 Event date
        c.eventId ? eventById.get(c.eventId)?.letter ?? '' : '',      // 17 Event letter
        yn(c.isLobbyist),                                 // 18 Lobbyist?
        '',                                               // 19 $400 CEO-candidate flag
        '',                                               // 20 Aggregate correction
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section T: worker reimbursements ──────────────────────────────────────
  {
    const ws = wb.Sheets['Section T']
    if (ws && reimbs.length > 0) {
      // Section P rows are numbered i+1 above; a linked reimbursement points
      // at its Section P payment through that same number
      const expNumberById = new Map(expends.map((e, i) => [e.id, i + 1]))
      const rows = reimbs.map((r, i) => [
        i + 1,                                            //  0 Transaction ID
        r.workerLastName,                                 //  1 Last Name of Worker/Consultant
        r.workerFirstName,                                //  2 First Name
        r.workerMiddleInitial ?? '',                      //  3 Middle Initial
        r.description,                                    //  4 Description
        seecDate(r.date),                                 //  5 Date Payment
        r.amount,                                         //  6 Amount
        EXPENDITURE_METHOD[r.method] ?? 'CH',             //  7 Method of Payment
        r.checkNumber ?? '',                              //  8 Check
        r.vendorName ?? '',                               //  9 Name of Vendor
        r.street ?? '',                                   // 10 Street Address
        r.city ?? '',                                     // 11 City
        r.state,                                          // 12 State
        r.zip ?? '',                                      // 13 Zip
        r.expenditureId ? expNumberById.get(r.expenditureId) ?? '' : '', // 14 Expenditure Number (Section P row)
        'NONE',                                           // 15 Type (NONE = not coordinated)
        LEGACY_EXPENSE_PURPOSE[r.category] ?? r.category, // 16 Purpose code
        r.eventId ? seecDate(eventById.get(r.eventId)?.date ?? '') : '', // 17 Event date
        r.eventId ? eventById.get(r.eventId)?.letter ?? '' : '',      // 18 Event letter
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}

// ─── Preview data (used by the dialog before generating) ─────────────────────

export interface Form20Preview {
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

export function previewForm20(
  contributions: Contribution[],
  expenditures: Expenditure[],
  periodStart: string,
  periodEnd: string,
  events: CommitteeEvent[] = [],
  committeeContributions: CommitteeContribution[] = [],
  inKindContributions: InKindContribution[] = [],
  reimbursements: Reimbursement[] = []
): Form20Preview {
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
