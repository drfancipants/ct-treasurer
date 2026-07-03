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

describe('Section L1 — events', () => {
  const makeEvent = (o: Partial<import('../types').CommitteeEvent> = {}): import('../types').CommitteeEvent => ({
    id: 'ev_1', committeeId: 'com_1', date: '2026-05-10', letter: 'A',
    description: 'Spring Dinner', isFundraiser: true,
    street: '14 Whitfield St', city: 'Guilford', state: 'CT', zip: '06437',
    isPersonalResidence: false, hadDonatedGoods: false, wasTagSale: true,
    hadProgramBook: false, soldFoodAtFair: false,
    foodReceipts: 0, tagSaleReceipts: 340, notes: undefined, createdAt: '2026-05-10T00:00:00Z',
    ...o,
  })

  it('writes events to Section L1 with Y/N flags and receipts', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const ev = makeEvent()
    const out = populateForm20(template, [], [], Q2_START, Q2_END, [ev])
    const rows = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section L1'], { header: 1 })
    const r = rows[1]
    expect(r[1]).toBe('05/10/2026')  // date
    expect(r[2]).toBe('A')           // letter
    expect(r[3]).toBe('Spring Dinner')
    expect(r[4]).toBe('Y')           // fundraiser
    expect(r[6]).toBe('Guilford')    // city
    expect(r[11]).toBe('Y')          // tag sale
    expect(r[15]).toBe(340)          // tag-sale receipts
  })

  it('excludes out-of-period events and counts them in preview', () => {
    const inP = makeEvent({ id: 'in', date: '2026-05-01' })
    const outP = makeEvent({ id: 'out', date: '2026-08-01', letter: 'B' })
    const p = previewForm20([], [], Q2_START, Q2_END, [inP, outP])
    expect(p.eventCount).toBe(1)
    expect(p.eventTotal).toBe(340)
  })
})

describe('contribution/expense event linkage', () => {
  const ev: import('../types').CommitteeEvent = {
    id: 'ev_link', committeeId: 'com_1', date: '2026-05-10', letter: 'C',
    description: 'Gala', isFundraiser: true, state: 'CT',
    isPersonalResidence: false, hadDonatedGoods: false, wasTagSale: false,
    hadProgramBook: false, soldFoodAtFair: false, foodReceipts: 0, tagSaleReceipts: 0,
    createdAt: '2026-05-10T00:00:00Z',
  }

  it('fills Section B event columns for a linked contribution', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const linked = makeContribution({ id: 'c_link', amount: 100, date: '2026-05-15', eventId: 'ev_link' })
    const out = populateForm20(template, [linked], [], Q2_START, Q2_END, [ev])
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section B'], { header: 1 })[1]
    expect(r[15]).toBe('Y')            // associated with an event
    expect(r[16]).toBe('05/10/2026')   // event date
    expect(r[17]).toBe('C')            // event letter
  })

  it('fills Section P event columns for a linked expense', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const linked = makeExpenditure({ id: 'e_link', amount: 200, date: '2026-05-20', eventId: 'ev_link' })
    const out = populateForm20(template, [], [linked], Q2_START, Q2_END, [ev])
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section P'], { header: 1 })[1]
    expect(r[11]).toBe('05/10/2026')   // event date
    expect(r[12]).toBe('C')            // event letter
  })

  it('leaves event columns blank when unlinked (N in Section B)', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const out = populateForm20(template, [makeContribution({ id: 'c_no', amount: 100, date: '2026-05-15' })], [], Q2_START, Q2_END, [ev])
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section B'], { header: 1 })[1]
    expect(r[15]).toBe('N')
    expect(r[17]).toBe('')
  })
})

describe('Section C1 — committee contributions', () => {
  const cc = (o: Partial<import('../types').CommitteeContribution> = {}): import('../types').CommitteeContribution => ({
    id: 'cc_1', committeeId: 'com_1', fromName: 'Madison DTC', treasurerName: 'Pat Jones',
    street: '1 Main St', city: 'Madison', state: 'CT', zip: '06443',
    date: '2026-05-05', amount: 500, createdAt: '2026-05-05T00:00:00Z', ...o,
  })

  it('writes committee contributions to Section C1', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const out = populateForm20(template, [], [], Q2_START, Q2_END, [], [cc()])
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section C1'], { header: 1 })[1]
    expect(r[1]).toBe('Madison DTC')     // committee name
    expect(r[2]).toBe('Pat Jones')       // treasurer
    expect(r[4]).toBe('Madison')         // city
    expect(r[7]).toBe('05/05/2026')      // date received
    expect(r[8]).toBe(500)               // amount
    expect(r[9]).toBe('N')               // not event-associated
  })

  it('counts committee contributions in the preview and excludes out-of-period', () => {
    const p = previewForm20([], [], Q2_START, Q2_END, [], [cc({ id: 'in', date: '2026-05-05' }), cc({ id: 'out', date: '2026-09-01' })])
    expect(p.committeeContribCount).toBe(1)
    expect(p.committeeContribTotal).toBe(500)
  })
})

describe('Section M — in-kind contributions', () => {
  const ik = (o: Partial<import('../types').InKindContribution> = {}): import('../types').InKindContribution => ({
    id: 'ik_1', committeeId: 'com_1', entityType: 'IS',
    lastName: 'Baker', firstName: 'Sam', middleInitial: 'Q',
    street: '3 Oak St', city: 'Guilford', state: 'CT', zip: '06437',
    date: '2026-05-08', fairMarketValue: 250, description: 'Printing of palm cards',
    isStateContractorPrincipal: false, isLobbyist: false,
    createdAt: '2026-05-08T00:00:00Z', ...o,
  })

  it('writes in-kind contributions to Section M', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const out = populateForm20(template, [], [], Q2_START, Q2_END, [], [], [ik()])
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section M'], { header: 1 })[1]
    expect(r[1]).toBe('Baker')                 // last name
    expect(r[2]).toBe('Sam')                   // first name
    expect(r[6]).toBe('Guilford')              // city
    expect(r[9]).toBe('05/08/2026')            // date received
    expect(r[10]).toBe(250)                    // fair market value
    expect(r[11]).toBe('IS')                   // entity type
    expect(r[12]).toBe('Printing of palm cards')
    expect(r[13]).toBe('N')                    // not a contractor principal
    expect(r[18]).toBe('N')                    // not a lobbyist
  })

  it('writes committee entity name and contractor branch', () => {
    const buf = readFileSync(TEMPLATE_PATH)
    const template = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const row = ik({ entityType: 'CO', lastName: 'Acme PAC', firstName: undefined, entityName: 'Acme PAC', isStateContractorPrincipal: true, contractorBranch: 'L' })
    const out = populateForm20(template, [], [], Q2_START, Q2_END, [], [], [row])
    const r = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(out, { type: 'array' }).Sheets['Section M'], { header: 1 })[1]
    expect(r[4]).toBe('Acme PAC')  // Name of Committee
    expect(r[11]).toBe('CO')
    expect(r[13]).toBe('Y')
    expect(r[14]).toBe('L')        // branch
  })

  it('counts in-kind in the preview and excludes out-of-period', () => {
    const p = previewForm20([], [], Q2_START, Q2_END, [], [], [ik({ id: 'in', date: '2026-05-08' }), ik({ id: 'out', date: '2026-09-01' })])
    expect(p.inKindCount).toBe(1)
    expect(p.inKindTotal).toBe(250)
  })
})
