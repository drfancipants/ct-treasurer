import { describe, it, expect } from 'vitest'
import { parseAnedotCsv } from '../anedot-csv'
import { makeContribution } from './helpers'

const ANEDOT_HEADER =
  'Donation ID,Date,First Name,Last Name,Email,Amount,Payment Method,Address Line 1,City,State,Zip,Employer,Occupation,Status'

function csv(...rows: string[]): string {
  return [ANEDOT_HEADER, ...rows].join('\n')
}

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
