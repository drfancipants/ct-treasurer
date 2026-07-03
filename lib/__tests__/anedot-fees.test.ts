import { describe, it, expect } from 'vitest'
import { groupFeesByQuarter } from '../anedot-fees'

describe('groupFeesByQuarter', () => {
  it('batches fees into one expenditure per calendar quarter', () => {
    const batches = groupFeesByQuarter([
      { id: 'a', date: '2026-04-09', processingFee: 2.4 },
      { id: 'b', date: '2026-06-20', processingFee: 3.9 },
      { id: 'c', date: '2026-07-01', processingFee: 1.55 },
    ])
    expect(batches).toHaveLength(2)
    expect(batches[0]).toMatchObject({
      quarter: '2026-Q2',
      contributionIds: ['a', 'b'],
      total: 6.3,
      count: 2,
      date: '2026-06-20',   // expenditure dated inside the filing period
      fromDate: '2026-04-09',
    })
    expect(batches[1]).toMatchObject({ quarter: '2026-Q3', total: 1.55, count: 1 })
  })

  it('rounds floating-point sums to cents', () => {
    const batches = groupFeesByQuarter([
      { id: 'a', date: '2026-01-05', processingFee: 0.1 },
      { id: 'b', date: '2026-02-05', processingFee: 0.2 },
    ])
    expect(batches[0].total).toBe(0.3)
  })

  it('ignores rows without a positive fee or a date', () => {
    const batches = groupFeesByQuarter([
      { id: 'a', date: '2026-04-09', processingFee: 0 },
      { id: 'b', date: '', processingFee: 5 },
    ])
    expect(batches).toHaveLength(0)
  })
})
