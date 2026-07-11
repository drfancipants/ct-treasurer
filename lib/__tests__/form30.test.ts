import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { populateForm30 } from '../form30'
import { makeContribution, makeExpenditure } from './helpers'

const TEMPLATE_PATH = join(__dirname, '../../public/templates/Form_30_Upload_Template.xls')

const Q2_START = '2026-04-01'
const Q2_END = '2026-06-30'

function loadTemplate(): ArrayBuffer {
  const buf = readFileSync(TEMPLATE_PATH)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

const contributions = [
  makeContribution({
    id: 'don_a', amount: 150, date: '2026-05-15', method: 'CHECK',
    contributor: { firstName: 'Jane', lastName: 'Donor' },
  }),
  makeContribution({
    id: 'don_b', amount: 75.5, date: '2026-06-30', method: 'ONLINE',
    contributor: { firstName: 'Bob', lastName: 'Giver', address1: '9 Oak Ave', city: 'Guilford', zip: '06437' },
  }),
  makeContribution({ id: 'don_c', amount: 20, date: '2026-04-01', isItemized: false }),
  makeContribution({ id: 'don_d', amount: 15, date: '2026-05-01', isItemized: false }),
  makeContribution({ id: 'don_e', amount: 500, date: '2026-03-31' }), // out of period
]

const expenditures = [
  makeExpenditure({ id: 'exp_a', amount: 250, date: '2026-05-20', category: 'PRNT', method: 'CHECK', checkNumber: '1042' }),
  makeExpenditure({ id: 'exp_b', amount: 999, date: '2026-07-02' }), // out of period
]

describe('populateForm30 (against the real eCRIS Form 30 template)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const out = populateForm30(loadTemplate(), contributions, expenditures, Q2_START, Q2_END)
    wb = XLSX.read(out, { type: 'array' })
  })

  it('has the expected Form 30 sheets', () => {
    for (const s of ['Section A', 'Section B', 'Section C1', 'Section J1', 'Section K', 'Section N', 'Section R']) {
      expect(wb.SheetNames).toContain(s)
    }
  })

  it('writes the small-contribution total to Section A', () => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section A'], { header: 1 })
    expect(rows[1][0]).toBe(35)
  })

  it('writes Section B with the Form-30 column offsets (name at 2/3, not 1/2)', () => {
    // Form 30 Section B has an extra "Contribution ID" at index 1, shifting
    // the name/date/amount/method columns one right vs Form 20.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section B'], { header: 1 })
    const jane = rows[1]
    expect(jane[1]).toBe('')              // Contribution ID left blank
    expect(jane[2]).toBe('Donor')         // last name
    expect(jane[3]).toBe('Jane')          // first name
    expect(jane[11]).toBe('05/15/2026')   // date
    expect(jane[12]).toBe(150)            // amount
    expect(jane[13]).toBe('PC')           // CHECK → Personal Check
    expect(rows[2][13]).toBe('CD')        // ONLINE → Credit/Debit
  })

  it('writes contractor/lobbyist flags at the Form-30 positions', () => {
    const flagged = makeContribution({
      id: 'don_flags', amount: 100, date: '2026-05-01',
      isStateContractor: true, contractorBranch: 'L', isLobbyist: true,
      contributor: { middleInitial: 'Q' },
    })
    const out = populateForm30(loadTemplate(), [flagged], [], Q2_START, Q2_END)
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section B'], { header: 1 })[1]
    expect(r[4]).toBe('Q')   // middle initial
    expect(r[14]).toBe('Y')  // state contractor
    expect(r[15]).toBe('L')  // branch
    expect(r[19]).toBe('Y')  // lobbyist
  })

  it('writes expenditures to Section N with the coordinated flag and purpose code', () => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section N'], { header: 1 })
    const printing = rows[1]
    expect(printing[1]).toBe('Shoreline Printing') // payee
    expect(printing[6]).toBe('05/20/2026')         // date
    expect(printing[7]).toBe(250)                  // amount
    expect(printing[8]).toBe('CH')                 // CHECK → CH
    expect(printing[9]).toBe('1042')               // check number
    expect(printing[13]).toBe('N')                 // coordinated? (Form-30-specific column)
    expect(printing[15]).toBe('PRNT')              // purpose code
  })

  it('excludes out-of-period transactions', () => {
    const sectionB = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section B'], { header: 1 })
    expect(sectionB.slice(1).map((r) => r[12])).not.toContain(500)
    const sectionN = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section N'], { header: 1 })
    expect(sectionN.slice(1).map((r) => r[7])).not.toContain(999)
  })
})
