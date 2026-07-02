import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { populateForm20, previewForm20 } from '../form20'
import { makeContribution, makeExpenditure } from './helpers'

const TEMPLATE_PATH = join(__dirname, '../../public/templates/Form_20_Upload_Template.xls')

const Q2_START = '2026-04-01'
const Q2_END = '2026-06-30'

const contributions = [
  // Itemized, in period
  makeContribution({
    id: 'don_a', amount: 150, date: '2026-05-15', method: 'CHECK',
    contributor: { firstName: 'Jane', lastName: 'Donor' },
  }),
  // Itemized online, in period
  makeContribution({
    id: 'don_b', amount: 75.5, date: '2026-06-30', method: 'ONLINE',
    contributor: { firstName: 'Bob', lastName: 'Giver', address1: '9 Oak Ave', city: 'Guilford', zip: '06437' },
  }),
  // Non-itemized small donations, in period
  makeContribution({ id: 'don_c', amount: 20, date: '2026-04-01', isItemized: false }),
  makeContribution({ id: 'don_d', amount: 15, date: '2026-05-01', isItemized: false }),
  // Out of period — must be excluded
  makeContribution({ id: 'don_e', amount: 500, date: '2026-03-31' }),
  makeContribution({ id: 'don_f', amount: 500, date: '2026-07-01' }),
]

const expenditures = [
  makeExpenditure({ id: 'exp_a', amount: 250, date: '2026-05-20', category: 'PRNT', method: 'CHECK', checkNumber: '1042' }),
  makeExpenditure({ id: 'exp_b', amount: 89.99, date: '2026-06-10', category: 'A-SIGN', method: 'ONLINE', checkNumber: undefined, payee: 'SignCo' }),
  // Out of period
  makeExpenditure({ id: 'exp_c', amount: 999, date: '2026-07-02' }),
]

describe('previewForm20', () => {
  it('filters to the period with inclusive bounds and splits itemized/non-itemized', () => {
    const p = previewForm20(contributions, expenditures, Q2_START, Q2_END)
    expect(p.itemizedCount).toBe(2)
    expect(p.itemizedTotal).toBeCloseTo(225.5)
    expect(p.nonItemizedCount).toBe(2)
    expect(p.nonItemizedTotal).toBe(35)
    expect(p.expenditureCount).toBe(2)
    expect(p.expenditureTotal).toBeCloseTo(339.99)
  })

  it('reports SEEC issues only for itemized contributions with problems', () => {
    const withIssue = [
      ...contributions,
      makeContribution({
        id: 'don_g', amount: 100, date: '2026-05-02',
        contributor: { employer: undefined, occupation: undefined },
      }),
    ]
    const p = previewForm20(withIssue, [], Q2_START, Q2_END)
    expect(p.seecIssues).toHaveLength(1)
    expect(p.seecIssues[0].contributionId).toBe('don_g')
  })
})

describe('populateForm20 (against the real eCRIS template)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const out = populateForm20(template, contributions, expenditures, Q2_START, Q2_END)
    wb = XLSX.read(out, { type: 'array' })
  })

  it('writes the small-contribution total to Section A', () => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section A'], { header: 1 })
    expect(rows[1][0]).toBe(35)
  })

  it('writes itemized contributions to Section B with SEEC method codes and dates', () => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section B'], { header: 1 })
    const [jane, bob] = [rows[1], rows[2]]

    expect(jane[1]).toBe('Donor')          // last name
    expect(jane[2]).toBe('Jane')           // first name
    expect(jane[10]).toBe('05/15/2026')    // SEEC date format
    expect(jane[11]).toBe(150)
    expect(jane[12]).toBe('PC')            // CHECK → Personal Check

    expect(bob[1]).toBe('Giver')
    expect(bob[11]).toBe(75.5)
    expect(bob[12]).toBe('CD')             // ONLINE → Credit/Debit
  })

  it('writes expenditures to Section P with purpose and payment codes', () => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section P'], { header: 1 })
    const [printing, signage] = [rows[1], rows[2]]

    expect(printing[1]).toBe('Shoreline Printing')
    expect(printing[6]).toBe('05/20/2026')
    expect(printing[8]).toBe('CH')         // CHECK → CH
    expect(printing[9]).toBe('1042')       // check number
    expect(printing[15]).toBe('PRNT')      // stored SEEC code passes through

    expect(signage[1]).toBe('SignCo')
    expect(signage[8]).toBe('EFT')         // ONLINE → EFT
    expect(signage[15]).toBe('A-SIGN')
  })

  it('maps legacy app categories to SEEC codes', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const legacy = makeExpenditure({ id: 'exp_legacy', date: '2026-05-01' })
    // Simulate a pre-migration row that still carries an old app category
    ;(legacy as { category: string }).category = 'HEADQUARTERS'
    const out = populateForm20(template, [], [legacy], Q2_START, Q2_END)
    const sheet = XLSX.read(out, { type: 'array' }).Sheets['Section P']
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    expect(rows[1][15]).toBe('OVHD')
  })

  it('excludes out-of-period transactions everywhere', () => {
    const sectionB = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section B'], { header: 1 })
    const amounts = sectionB.slice(1).map((r) => r[11])
    expect(amounts).not.toContain(500)

    const sectionP = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Section P'], { header: 1 })
    const expAmounts = sectionP.slice(1).map((r) => r[7])
    expect(expAmounts).not.toContain(999)
  })
})
