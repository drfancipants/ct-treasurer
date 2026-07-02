import { describe, it, expect } from 'vitest'
import {
  donorKey,
  getDonorYearTotals,
  getLimitAlerts,
  checkProspective,
  INDIVIDUAL_ANNUAL_LIMIT,
} from '../limits'
import { makeContribution } from './helpers'

describe('donorKey', () => {
  it('groups by lowercased email when present', () => {
    expect(donorKey({ email: 'Jane@X.com ', firstName: 'J', lastName: 'D', zip: '06443' }))
      .toBe(donorKey({ email: 'jane@x.com', firstName: 'Different', lastName: 'Name', zip: '00000' }))
  })

  it('falls back to normalized name + ZIP5 without email', () => {
    const a = donorKey({ firstName: "Mary-Ann O'Brien".split(' ')[0], lastName: "O'Brien", zip: '06443-1234' })
    const b = donorKey({ firstName: 'MARYANN', lastName: 'obrien', zip: '06443' })
    expect(a).toBe(b)
  })

  it('does not conflate different people', () => {
    expect(donorKey({ firstName: 'Jane', lastName: 'Doe', zip: '06443' }))
      .not.toBe(donorKey({ firstName: 'John', lastName: 'Doe', zip: '06443' }))
  })
})

describe('getDonorYearTotals', () => {
  const contributions = [
    makeContribution({ id: 'a', amount: 1500, date: '2026-02-01' }),
    makeContribution({ id: 'b', amount: 300, date: '2026-06-01' }),
    // Same donor, previous year — separate bucket
    makeContribution({ id: 'c', amount: 1900, date: '2025-11-01' }),
    // Different donor
    makeContribution({
      id: 'd', amount: 50, date: '2026-03-01',
      contributor: { id: 'con_2', email: 'bob@x.com', firstName: 'Bob', lastName: 'Giver' },
    }),
  ]

  it('sums per donor per calendar year', () => {
    const totals = getDonorYearTotals(contributions)
    const jane26 = totals.find((d) => d.name === 'Jane Donor' && d.year === 2026)!
    const jane25 = totals.find((d) => d.name === 'Jane Donor' && d.year === 2025)!
    expect(jane26.total).toBe(1800)
    expect(jane26.count).toBe(2)
    expect(jane26.remaining).toBe(200)
    expect(jane25.total).toBe(1900)
  })

  it('flags warning at 80% and over above the limit', () => {
    const totals = getDonorYearTotals(contributions)
    expect(totals.find((d) => d.name === 'Jane Donor' && d.year === 2026)!.status).toBe('warning')
    expect(totals.find((d) => d.name === 'Bob Giver')!.status).toBe('ok')

    const over = getDonorYearTotals([
      ...contributions,
      makeContribution({ id: 'e', amount: 300, date: '2026-07-01' }),
    ])
    const jane = over.find((d) => d.name === 'Jane Donor' && d.year === 2026)!
    expect(jane.total).toBe(2100)
    expect(jane.status).toBe('over')
    expect(jane.remaining).toBe(0)
  })

  it('aggregates duplicate contributor rows for the same email', () => {
    const dup = [
      makeContribution({ id: 'a', amount: 1000, date: '2026-01-01', contributor: { id: 'con_1' } }),
      makeContribution({ id: 'b', amount: 900, date: '2026-02-01', contributor: { id: 'con_99' } }),
    ]
    const totals = getDonorYearTotals(dup)
    expect(totals).toHaveLength(1)
    expect(totals[0].total).toBe(1900)
    expect(totals[0].contributorIds).toEqual(['con_1', 'con_99'])
  })
})

describe('getLimitAlerts', () => {
  it('returns only current-year donors at warning or over', () => {
    const alerts = getLimitAlerts(
      [
        makeContribution({ id: 'a', amount: 1700, date: '2026-01-15' }),
        makeContribution({ id: 'b', amount: 1999, date: '2025-01-15' }), // prior year
        makeContribution({
          id: 'c', amount: 100, date: '2026-01-15',
          contributor: { id: 'con_2', email: 'bob@x.com', firstName: 'Bob', lastName: 'Giver' },
        }),
      ],
      2026
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].name).toBe('Jane Donor')
  })
})

describe('checkProspective', () => {
  const existing = [makeContribution({ id: 'a', amount: 1900, date: '2026-01-01' })]
  const jane = { email: 'jane@example.com', firstName: 'Jane', lastName: 'Donor', zip: '06443' }

  it('reports headroom for a donor under the limit', () => {
    const r = checkProspective(existing, jane, 50, '2026-06-01')
    expect(r.priorTotal).toBe(1900)
    expect(r.newTotal).toBe(1950)
    expect(r.remaining).toBe(50)
    expect(r.wouldExceed).toBe(false)
    expect(r.status).toBe('warning')
  })

  it('flags a contribution that would exceed the annual limit', () => {
    const r = checkProspective(existing, jane, 200, '2026-06-01')
    expect(r.newTotal).toBe(2100)
    expect(r.wouldExceed).toBe(true)
    expect(r.status).toBe('over')
  })

  it('scopes to the calendar year of the new contribution', () => {
    const r = checkProspective(existing, jane, 200, '2027-01-05')
    expect(r.priorTotal).toBe(0)
    expect(r.wouldExceed).toBe(false)
  })

  it('flags single cash contributions over $100', () => {
    expect(checkProspective([], jane, 150, '2026-06-01', 'CASH').cashOverMax).toBe(true)
    expect(checkProspective([], jane, 100, '2026-06-01', 'CASH').cashOverMax).toBe(false)
    expect(checkProspective([], jane, 150, '2026-06-01', 'CHECK').cashOverMax).toBe(false)
  })

  it('exposes the statutory limit constant', () => {
    expect(INDIVIDUAL_ANNUAL_LIMIT).toBe(2000)
  })
})
