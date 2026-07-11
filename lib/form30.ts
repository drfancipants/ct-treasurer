import * as XLSX from 'xlsx'
import type { Contribution, Expenditure, CommitteeEvent, CommitteeContribution, InKindContribution, Reimbursement } from './types'
import {
  yn,
  seecDate,
  inPeriod,
  CONTRIBUTION_METHOD,
  EXPENDITURE_METHOD,
  LEGACY_EXPENSE_PURPOSE,
} from './seec-export'

// ─── SEEC Form 30 export ─────────────────────────────────────────────────────
// Statewide & General Assembly candidate committees file Form 30 (municipal &
// probate candidates and party committees use Form 20 — see lib/form20.ts).
// The column layouts below are eyeballed against the real eCRIS upload template
// in public/templates/Form_30_Upload_Template.xls, section by section — they
// are NOT the same as Form 20's, so this can't share Form 20's row-builders:
//   · Section B has an extra "Contribution ID" column at index 1 and drops
//     Form 20's "municipality contract?" column
//   · Section J1 (events) omits Form 20 L1's program-book / sold-food / food
//     receipts columns
//   · Section K (in-kind) drops Form 20 M's "$400 CEO-candidate" column
//   · Sections N/R (expenses/reimbursements) carry a "coordinated?" Y/N column
//     where Form 20 P/T put a literal "NONE" type, and order event columns
//     differently
// The shared method/purpose code maps come from seec-export.ts.

/**
 * Loads the official eCRIS Form 30 template, populates the mapped sections
 * (A small contributions, B itemized individuals, C1 committee contributions,
 * J1 events, K in-kind, N expenses, R reimbursements) with data in the given
 * period, and returns the workbook as a Uint8Array ready to download as .xls.
 */
export function populateForm30(
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

  // ── Section B: itemized individual contributions ──────────────────────────
  {
    const ws = wb.Sheets['Section B']
    if (ws && itemized.length > 0) {
      const rows = itemized.map((c) => [
        '',                                                //  0 User Supplied Transaction ID (optional)
        '',                                                //  1 Contribution ID (assigned by eCRIS — left blank)
        c.contributor.lastName,                           //  2 Last Name
        c.contributor.firstName,                          //  3 First Name
        c.contributor.middleInitial ?? '',                //  4 Middle Initial
        c.contributor.address1,                           //  5 Street Address
        c.contributor.city,                               //  6 City
        c.contributor.state,                              //  7 State
        c.contributor.zip,                                //  8 Zip
        c.contributor.employer  ?? '',                    //  9 Employer
        c.contributor.occupation ?? '',                   // 10 Occupation
        seecDate(c.date),                                 // 11 Date Received
        c.amount,                                         // 12 Amount
        CONTRIBUTION_METHOD[c.method] ?? 'PC',            // 13 Method code
        c.isStateContractor ? 'Y' : 'N',                  // 14 State contractor principal?
        c.isStateContractor ? (c.contractorBranch ?? '') : '', // 15 Which branch?
        c.eventId && eventById.has(c.eventId) ? 'Y' : 'N',            // 16 Associated with a J1 event?
        c.eventId ? seecDate(eventById.get(c.eventId)?.date ?? '') : '', // 17 Event date
        c.eventId ? eventById.get(c.eventId)?.letter ?? '' : '',      // 18 Event letter
        c.isLobbyist ? 'Y' : 'N',                         // 19 Lobbyist?
        '',                                               // 20 Aggregate correction
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section C1: contributions from other committees ──────────────────────
  {
    const ws = wb.Sheets['Section C1']
    if (ws && cmteC.length > 0) {
      const rows = cmteC.map((c) => [
        '',                                               //  0 User Supplied Transaction ID (optional)
        c.fromName,                                       //  1 Name of Committee
        c.treasurerName ?? '',                            //  2 Name of Treasurer
        c.street ?? '',                                   //  3 Committee Street Address
        c.city ?? '',                                     //  4 City
        c.state,                                          //  5 State
        c.zip ?? '',                                      //  6 Zip
        seecDate(c.date),                                 //  7 Date Received
        c.amount,                                         //  8 Amount
        c.eventId && eventById.has(c.eventId) ? 'Y' : 'N',            //  9 Associated with a J1 event?
        c.eventId ? seecDate(eventById.get(c.eventId)?.date ?? '') : '', // 10 Event date
        c.eventId ? eventById.get(c.eventId)?.letter ?? '' : '',      // 11 Event letter
        '',                                               // 12 Aggregate correction
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section J1: fundraising / event information ───────────────────────────
  {
    const ws = wb.Sheets['Section J1']
    if (ws && evts.length > 0) {
      const rows = evts.map((e) => [
        '',                              //  0 User Supplied Transaction ID (optional)
        seecDate(e.date),               //  1 Date of Event
        e.letter,                       //  2 Letter for Event#
        e.description,                  //  3 Event Description
        yn(e.isFundraiser),             //  4 Was this a fundraising event?
        e.street ?? '',                 //  5 Street Address
        e.city ?? '',                   //  6 City
        e.state,                        //  7 State
        e.zip ?? '',                    //  8 Zip
        yn(e.isPersonalResidence),      //  9 Hosted at a personal residence?
        yn(e.hadDonatedGoods),          // 10 Included donated goods (≤$100)?
        yn(e.wasTagSale),               // 11 Tag sale / auction?
        e.tagSaleReceipts,              // 12 Total Receipts TagSale
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section K: in-kind contributions ──────────────────────────────────────
  {
    const ws = wb.Sheets['Section K']
    if (ws && inKind.length > 0) {
      const rows = inKind.map((c) => [
        '',                                                //  0 User Supplied Transaction ID (optional)
        c.lastName,                                       //  1 Last Name / entity name
        c.firstName ?? '',                                //  2 First Name
        c.middleInitial ?? '',                            //  3 Middle Initial
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
        c.eventId && eventById.has(c.eventId) ? 'Y' : 'N',            // 15 Associated with a J1 event?
        c.eventId ? seecDate(eventById.get(c.eventId)?.date ?? '') : '', // 16 Event date
        c.eventId ? eventById.get(c.eventId)?.letter ?? '' : '',      // 17 Event letter
        yn(c.isLobbyist),                                 // 18 Lobbyist?
        '',                                               // 19 Aggregate correction
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section N: expenses paid by committee ─────────────────────────────────
  {
    const ws = wb.Sheets['Section N']
    if (ws && expends.length > 0) {
      const rows = expends.map((e) => [
        '',                                                //  0 User Supplied Transaction ID (optional)
        e.payee,                                          //  1 Payee Name
        e.payeeAddress1 ?? '',                            //  2 Street Address
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
        'N',                                              // 13 Coordinated with another candidate?
        '',                                               // 14 Expenditure Number (optional)
        LEGACY_EXPENSE_PURPOSE[e.category] ?? e.category, // 15 Purpose code
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  // ── Section R: worker reimbursements & secondary payees ───────────────────
  {
    const ws = wb.Sheets['Section R']
    if (ws && reimbs.length > 0) {
      const rows = reimbs.map((r) => [
        '',                                                //  0 User Supplied Transaction ID (optional)
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
        r.eventId ? seecDate(eventById.get(r.eventId)?.date ?? '') : '', // 14 Event date
        r.eventId ? eventById.get(r.eventId)?.letter ?? '' : '',      // 15 Event letter
        'N',                                              // 16 Coordinated with another candidate?
        '',                                               // 17 Expenditure Number (optional)
        LEGACY_EXPENSE_PURPOSE[r.category] ?? r.category, // 18 Purpose code
      ])
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' })
    }
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array
}
