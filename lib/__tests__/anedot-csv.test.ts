import { describe, it, expect } from 'vitest'
import { parseAnedotCsv } from '../anedot-csv'
import { makeContribution } from './helpers'

const ANEDOT_HEADER =
  'Donation ID,Date,First Name,Last Name,Email,Amount,Payment Method,Address Line 1,City,State,Zip,Employer,Occupation,Status'

function csv(...rows: string[]): string {
  return [ANEDOT_HEADER, ...rows].join('\n')
}

describe('ledger export format', () => {
  // Headers exactly as Anedot's ledger CSV emits them, including the
  // multiline CT compliance questions
  const LEDGER_HEADER = [
    'Number', 'Processed Date', 'Type', 'Donation Date', 'Donation Amount',
    'Gross Amount', 'Net Amount', 'Anedot Fee', 'UID', 'Status', 'Campaign',
    'First Name', 'Middle Initial', 'Last Name', 'Address Line 1', 'City',
    'State', 'Zip', 'Source Type', 'Card Type', 'Card Last 4', 'Phone',
    'Email', 'Employer', 'Occupation', 'Check Number', 'Comments', 'Recurring',
    '"Are you a communicator lobbyist,\n OR the spouse or dependent child of a communicator lobbyist?"',
    '"Are you a principal of a state contractor or prospective state contractor? If Yes,\n please indicate which branch of the government the contract is with."',
    'Donor Covered Fees',
    'Name of Employer  (If self employed list name of business)',
    'Principal Occupation (If self employed provide job description)',
  ].join(',')

  function ledgerRow(o: Record<string, string> = {}): string {
    const d = {
      number: '1', processed: '2026-04-09 20:57:08 -0400', type: 'Donation',
      date: '2026-04-09', amount: '$52.40', gross: '$50.00', net: '$50.00',
      fee: '$2.40', uid: 'led_1', status: 'completed', campaign: 'online',
      first: 'Jane', mi: 'Q', last: 'Ledger', addr: '12 Elm St', city: 'Guilford',
      state: 'CT', zip: '06437', sourceType: 'credit_card', cardType: 'visa',
      last4: '3002', phone: '', email: 'jane.ledger@x.com', employer: 'Acme',
      occupation: 'Engineer', check: '', comments: '', recurring: '',
      lobbyist: 'No', contractor: 'No', coveredFees: 'true',
      customEmployer: '', customOccupation: '', ...o,
    }
    return [
      d.number, d.processed, d.type, d.date, d.amount, d.gross, d.net, d.fee,
      d.uid, d.status, d.campaign, d.first, d.mi, d.last, d.addr, d.city,
      d.state, d.zip, d.sourceType, d.cardType, d.last4, d.phone, d.email,
      d.employer, d.occupation, d.check, d.comments, d.recurring,
      d.lobbyist, d.contractor, d.coveredFees,
      d.customEmployer, d.customOccupation,
    ].join(',')
  }

  it('maps ledger money, card, and identity columns', () => {
    const result = parseAnedotCsv([LEDGER_HEADER, ledgerRow()].join('\n'), [])
    expect(result.formatDetected).toBe(true)
    expect(result.importableCount).toBe(1)
    const r = result.rows[0]
    expect(r.amount).toBe(52.4)              // what the donor gave
    expect(r.netAmount).toBe(50)             // what hit the bank
    expect(r.processingFee).toBe(2.4)
    expect(r.donorCoveredFees).toBe(true)
    expect(r.date).toBe('2026-04-09')
    expect(r.processedDate).toBe('2026-04-09') // -0400 offset must not shift the day
    expect(r.method).toBe('CREDIT_CARD')     // derived from Source Type
    expect(r.cardType).toBe('visa')
    expect(r.cardLast4).toBe('3002')
    expect(r.middleInitial).toBe('Q')
    expect(r.campaign).toBe('online')
    expect(r.anedotId).toBe('led_1')
    expect(r.isStateContractor).toBe(false)
    expect(r.isLobbyist).toBe(false)
  })

  it('parses affirmative SEEC answers with contract branch', () => {
    const result = parseAnedotCsv(
      [LEDGER_HEADER, ledgerRow({ lobbyist: 'Yes', contractor: 'Yes - Executive Branch' })].join('\n'),
      []
    )
    const r = result.rows[0]
    expect(r.isLobbyist).toBe(true)
    expect(r.isStateContractor).toBe(true)
    expect(r.contractorBranch).toBe('E')
  })

  it('reads employer/occupation from the CT custom questions when the built-in columns are empty', () => {
    const result = parseAnedotCsv(
      [LEDGER_HEADER, ledgerRow({ employer: '', occupation: '', customEmployer: 'NH BOE', customOccupation: 'Teacher' })].join('\n'),
      []
    )
    const r = result.rows[0]
    expect(r.employer).toBe('NH BOE')
    expect(r.occupation).toBe('Teacher')
    expect(r.seecIssues).toEqual([])
  })

  it('skips non-donation ledger rows (withdrawals, fees)', () => {
    const result = parseAnedotCsv(
      [LEDGER_HEADER, ledgerRow(), ledgerRow({ type: 'Withdrawal', uid: 'led_w1' })].join('\n'),
      []
    )
    expect(result.importableCount).toBe(1)
    expect(result.errorCount).toBe(1)
    expect(result.rows[1].errorMessage).toBe('Skipped — type: Withdrawal')
  })
})

describe('roster member matching', () => {
  const roster = (o: Partial<import('../types').RosterMember> = {}): import('../types').RosterMember => ({
    id: 'rm_1', committeeId: 'com_1', firstName: 'Jane', lastName: 'Donor',
    email: 'jane@x.com', state: 'CT', isActive: true, duesPaid: false,
    contributionTotal: 0, contributionCount: 0,
    duesPaidViaAnedot: false, anedotDuesTotal: 0,
    createdAt: '2026-01-01T00:00:00Z', ...o,
  })

  it('annotates rows matching a roster member by email, case-insensitively', () => {
    const result = parseAnedotCsv(
      csv('an_r1,2026-05-01,J,Donor,JANE@X.com,100,credit_card,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'),
      [],
      [roster()]
    )
    expect(result.rows[0].rosterMatch).toBe('Jane Donor')
    expect(result.rosterMatchCount).toBe(1)
  })

  it('falls back to name matching when emails differ', () => {
    const result = parseAnedotCsv(
      csv('an_r2,2026-05-01,jane,DONOR,other@x.com,100,credit_card,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'),
      [],
      [roster({ email: 'jane.personal@x.com' })]
    )
    expect(result.rows[0].rosterMatch).toBe('Jane Donor')
  })

  it('leaves non-members unannotated and counts zero', () => {
    const result = parseAnedotCsv(
      csv('an_r3,2026-05-01,Sam,Stranger,sam@x.com,100,credit_card,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'),
      [],
      [roster()]
    )
    expect(result.rows[0].rosterMatch).toBeUndefined()
    expect(result.rosterMatchCount).toBe(0)
  })
})

describe('parseAnedotCsv', () => {
  it('detects the Anedot format and parses a clean row', () => {
    const result = parseAnedotCsv(
      csv('an_1,2026-05-01,Jane,Donor,jane@x.com,100.00,credit_card,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'),
      []
    )
    expect(result.formatDetected).toBe(true)
    expect(result.importableCount).toBe(1)
    expect(result.errorCount).toBe(0)
    const row = result.rows[0]
    expect(row.anedotId).toBe('an_1')
    expect(row.amount).toBe(100)
    expect(row.method).toBe('CREDIT_CARD')
    expect(row.date).toBe('2026-05-01')
    expect(row.seecIssues).toEqual([])
  })

  it('handles Anedot column-name variants', () => {
    const text = [
      'UID,Created At,First Name,Last Name,Email,Total Amount,Payment Type,Street,City,State,Postal Code,Employer Name,Occupation',
      'an_2,2026-05-02 17:36:09 UTC,Bob,Giver,bob@x.com,"$1,250.00",ACH,9 Oak Ave,Guilford,CT,06437,Self,Retired',
    ].join('\n')
    const result = parseAnedotCsv(text, [])
    expect(result.formatDetected).toBe(true)
    const row = result.rows[0]
    expect(row.anedotId).toBe('an_2')
    expect(row.date).toBe('2026-05-02')
    expect(row.amount).toBe(1250)
    expect(row.method).toBe('ONLINE')
    expect(row.zip).toBe('06437')
  })

  it('parses US-style dates', () => {
    const result = parseAnedotCsv(
      csv('an_3,03/22/2026,Jane,Donor,jane@x.com,20,cash,12 Elm St,Madison,CT,06443,,,Completed'),
      []
    )
    expect(result.rows[0].date).toBe('2026-03-22')
  })

  it('deduplicates against existing anedotIds', () => {
    const existing = [makeContribution({ anedotId: 'an_dup' })]
    const result = parseAnedotCsv(
      csv(
        'an_dup,2026-05-01,Jane,Donor,jane@x.com,100,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed',
        'an_new,2026-05-01,Bob,Giver,bob@x.com,100,check,9 Oak Ave,Guilford,CT,06437,Self,Retired,Completed'
      ),
      existing
    )
    expect(result.duplicateCount).toBe(1)
    expect(result.importableCount).toBe(1)
    expect(result.rows[0].isDuplicate).toBe(true)
    expect(result.rows[1].isDuplicate).toBe(false)
  })

  it('skips refunded rows as errors', () => {
    const result = parseAnedotCsv(
      csv('an_4,2026-05-01,Jane,Donor,jane@x.com,100,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Refunded'),
      []
    )
    expect(result.errorCount).toBe(1)
    expect(result.importableCount).toBe(0)
    expect(result.rows[0].errorMessage).toMatch(/Refunded/)
  })

  it('flags SEEC issues for $50+ rows missing employer/occupation', () => {
    const result = parseAnedotCsv(
      csv('an_5,2026-05-01,Jane,Donor,jane@x.com,50,check,12 Elm St,Madison,CT,06443,,,Completed'),
      []
    )
    expect(result.seecIssueCount).toBe(1)
    expect(result.rows[0].seecIssues).toEqual(['Missing employer', 'Missing occupation'])
  })

  it('does not flag employer/occupation under $50', () => {
    const result = parseAnedotCsv(
      csv('an_6,2026-05-01,Jane,Donor,jane@x.com,49.99,check,12 Elm St,Madison,CT,06443,,,Completed'),
      []
    )
    expect(result.seecIssueCount).toBe(0)
  })

  it('rejects invalid amounts and dates', () => {
    const result = parseAnedotCsv(
      csv(
        'an_7,2026-05-01,Jane,Donor,jane@x.com,abc,check,12 Elm St,Madison,CT,06443,,,Completed',
        'an_8,not-a-date,Bob,Giver,bob@x.com,25,check,9 Oak Ave,Guilford,CT,06437,,,Completed'
      ),
      []
    )
    expect(result.errorCount).toBe(2)
    expect(result.rows[0].errorMessage).toBe('Invalid amount')
    expect(result.rows[1].errorMessage).toBe('Invalid date')
  })

  it('excludes error and duplicate rows from the importable total', () => {
    const existing = [makeContribution({ anedotId: 'an_dup' })]
    const result = parseAnedotCsv(
      csv(
        'an_ok,2026-05-01,Jane,Donor,jane@x.com,100,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed',
        'an_dup,2026-05-01,Old,Row,old@x.com,200,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed',
        'an_bad,2026-05-01,No,Amount,no@x.com,,check,12 Elm St,Madison,CT,06443,,,Completed'
      ),
      existing
    )
    expect(result.totalAmount).toBe(100)
    expect(result.importableCount).toBe(1)
  })
})

describe('contribution limit flags', () => {
  it('flags rows that push a donor over the annual limit, counting existing + in-file totals', () => {
    const existing = [makeContribution({ amount: 1500, date: '2026-01-10' })] // jane@example.com
    const result = parseAnedotCsv(
      csv(
        'an_l1,2026-05-01,Jane,Donor,jane@example.com,400,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed',
        'an_l2,2026-06-01,Jane,Donor,jane@example.com,200,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'
      ),
      existing
    )
    expect(result.rows[0].limitIssues).toEqual([]) // 1900 — under
    expect(result.rows[1].limitIssues[0]).toMatch(/over the \$2,000 annual limit/) // 2100
    expect(result.limitIssueCount).toBe(1)
  })

  it('does not flag totals in a different calendar year', () => {
    const existing = [makeContribution({ amount: 1900, date: '2025-12-01' })]
    const result = parseAnedotCsv(
      csv('an_l3,2026-01-05,Jane,Donor,jane@example.com,500,check,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'),
      existing
    )
    expect(result.limitIssueCount).toBe(0)
  })

  it('flags cash contributions over $100', () => {
    const result = parseAnedotCsv(
      csv('an_l4,2026-05-01,Jane,Donor,jane@example.com,150,cash,12 Elm St,Madison,CT,06443,Acme,Engineer,Completed'),
      []
    )
    expect(result.rows[0].limitIssues[0]).toMatch(/Cash contribution over \$100/)
  })
})

describe('extended field capture', () => {
  it('captures phone, check number, and note/memo', () => {
    const header = 'Donation ID,Date,First Name,Last Name,Email,Phone,Amount,Payment Method,Check Number,Address Line 1,City,State,Zip,Employer,Occupation,Note,Status'
    const row = 'an_x1,2026-05-01,Jane,Donor,jane@x.com,203-555-0199,100,check,1042,12 Elm St,Madison,CT,06443,Acme,Engineer,In memory of Pat,Completed'
    const result = parseAnedotCsv([header, row].join('\n'), [])
    const r = result.rows[0]
    expect(r.phone).toBe('203-555-0199')
    expect(r.checkNumber).toBe('1042')
    expect(r.memo).toBe('In memory of Pat')
  })

  it('maps note-column variants (Designation) to memo', () => {
    const header = 'UID,Created At,First Name,Last Name,Email,Total Amount,Payment Type,Mobile,Designation'
    const row = 'an_x2,2026-05-02,Bob,Giver,bob@x.com,25,cash,860-555-0100,General Fund'
    const r = parseAnedotCsv([header, row].join('\n'), []).rows[0]
    expect(r.phone).toBe('860-555-0100')
    expect(r.memo).toBe('General Fund')
  })

  it('leaves new fields undefined when columns are absent', () => {
    const header = 'Donation ID,Date,First Name,Last Name,Email,Amount,Payment Method,Address Line 1,City,State,Zip'
    const row = 'an_x3,2026-05-01,Jane,Donor,jane@x.com,20,cash,12 Elm St,Madison,CT,06443'
    const r = parseAnedotCsv([header, row].join('\n'), []).rows[0]
    expect(r.phone).toBeUndefined()
    expect(r.memo).toBeUndefined()
  })
})
