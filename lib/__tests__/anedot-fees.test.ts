import { describe, it, expect } from 'vitest'
import { groupFeesByPeriod } from '../anedot-fees'
import type { FilingPeriod } from '../filing-periods'

const Q1_2026: FilingPeriod = { label: 'Q1 2026', start: '2026-01-01', end: '2026-03-31', due: 'Apr 10, 2026' }
const Q2_2026: FilingPeriod = { label: 'Q2 2026', start: '2026-04-01', end: '2026-06-30', due: 'Jul 10, 2026' }
const Q3_2026: FilingPeriod = { label: 'Q3 2026', start: '2026-07-01', end: '2026-09-30', due: 'Oct 10, 2026' }
const STANDARD_QUARTERS = [Q1_2026, Q2_2026, Q3_2026]

describe('groupFeesByPeriod', () => {
  it('batches fees into one expenditure per filing period', () => {
    const batches = groupFeesByPeriod(
      [
        { id: 'a', date: '2026-04-09', processingFee: 2.4 },
        { id: 'b', date: '2026-06-20', processingFee: 3.9 },
        { id: 'c', date: '2026-07-01', processingFee: 1.55 },
      ],
      STANDARD_QUARTERS
    )
    expect(batches).toHaveLength(2)
    expect(batches[0]).toMatchObject({
      periodLabel: 'Q2 2026',
      contributionIds: ['a', 'b'],
      total: 6.3,
      count: 2,
      date: '2026-06-20',   // expenditure dated inside the filing period
      fromDate: '2026-04-09',
    })
    expect(batches[1]).toMatchObject({ periodLabel: 'Q3 2026', total: 1.55, count: 1 })
  })

  it('splits fees around a custom filing period instead of lumping them into the whole quarter', () => {
    // A pre-election filing carved out of Q2 2026 splits it into two parts
    const preElection: FilingPeriod = { label: 'Pre-election filing', start: '2026-05-10', end: '2026-05-20', due: 'May 25, 2026', isCustom: true }
    const q2Before: FilingPeriod = { label: 'Q2 2026 (part)', start: '2026-04-01', end: '2026-05-09', due: 'Jul 10, 2026' }
    const q2After: FilingPeriod = { label: 'Q2 2026 (part)', start: '2026-05-21', end: '2026-06-30', due: 'Jul 10, 2026' }

    const batches = groupFeesByPeriod(
      [
        { id: 'a', date: '2026-04-09', processingFee: 2.4 }, // before the pre-election period
        { id: 'b', date: '2026-05-15', processingFee: 1.0 }, // inside the pre-election period
        { id: 'c', date: '2026-06-20', processingFee: 3.9 }, // after the pre-election period
      ],
      [q2Before, preElection, q2After]
    )
    expect(batches).toHaveLength(3)
    expect(batches.find((b) => b.contributionIds.includes('a'))).toMatchObject({ periodLabel: 'Q2 2026 (part)', total: 2.4 })
    expect(batches.find((b) => b.contributionIds.includes('b'))).toMatchObject({ periodLabel: 'Pre-election filing', total: 1.0 })
    expect(batches.find((b) => b.contributionIds.includes('c'))).toMatchObject({ periodLabel: 'Q2 2026 (part)', total: 3.9 })
  })

  it('falls back to a calendar quarter for a date outside every supplied period', () => {
    const batches = groupFeesByPeriod(
      [{ id: 'a', date: '2020-04-09', processingFee: 2.4 }],
      STANDARD_QUARTERS
    )
    expect(batches).toHaveLength(1)
    expect(batches[0]).toMatchObject({ periodLabel: '2020-Q2', total: 2.4 })
  })

  it('rounds floating-point sums to cents', () => {
    const batches = groupFeesByPeriod(
      [
        { id: 'a', date: '2026-01-05', processingFee: 0.1 },
        { id: 'b', date: '2026-02-05', processingFee: 0.2 },
      ],
      STANDARD_QUARTERS
    )
    expect(batches[0].total).toBe(0.3)
  })

  it('ignores rows without a positive fee or a date', () => {
    const batches = groupFeesByPeriod(
      [
        { id: 'a', date: '2026-04-09', processingFee: 0 },
        { id: 'b', date: '', processingFee: 5 },
      ],
      STANDARD_QUARTERS
    )
    expect(batches).toHaveLength(0)
  })
})
