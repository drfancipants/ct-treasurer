import { describe, it, expect } from 'vitest'
import { getMonthlyData, getTrailingMonths } from '../analytics'
import { makeContribution } from './helpers'

describe('getTrailingMonths', () => {
  it('returns exactly `count` months ending with the current month', () => {
    const now = new Date(2026, 6, 3) // Jul 3, 2026 — month is 0-indexed
    const monthly = getMonthlyData(
      [makeContribution({ date: '2026-05-15', amount: 100 })],
      []
    )
    const trailing = getTrailingMonths(monthly, 12, now)

    expect(trailing).toHaveLength(12)
    expect(trailing[0].monthKey).toBe('2025-08')
    expect(trailing[trailing.length - 1].monthKey).toBe('2026-07')
  })

  it('zero-fills months with no ledger activity instead of skipping them', () => {
    const now = new Date(2026, 6, 3)
    const monthly = getMonthlyData(
      [makeContribution({ date: '2026-05-15', amount: 100 })],
      []
    )
    const trailing = getTrailingMonths(monthly, 12, now)

    const may = trailing.find((m) => m.monthKey === '2026-05')
    const jun = trailing.find((m) => m.monthKey === '2026-06')
    expect(may?.raised).toBe(100)
    expect(jun?.raised).toBe(0)
    expect(jun?.spent).toBe(0)
  })

  it('preserves bankBalance when already attached to a month', () => {
    const now = new Date(2026, 6, 3)
    const monthly = getMonthlyData([makeContribution({ date: '2026-05-15' })], [])
    const withBalance = monthly.map((m) => ({ ...m, bankBalance: 500 }))
    const trailing = getTrailingMonths(withBalance, 12, now)
    expect(trailing.find((m) => m.monthKey === '2026-05')?.bankBalance).toBe(500)
  })
})

describe('getMonthlyData + getTrailingMonths (newsletter chart data source)', () => {
  it('produces the same trailing window the dashboard chart uses, for the raised series alone', () => {
    const now = new Date(2026, 6, 3)
    const contributions = [
      makeContribution({ date: '2026-06-01', amount: 50 }),
      makeContribution({ date: '2026-06-10', amount: 25 }),
      makeContribution({ date: '2025-09-01', amount: 999 }), // outside the 12-month window
    ]
    const trailing = getTrailingMonths(getMonthlyData(contributions, []), 12, now)

    expect(trailing.map((m) => m.monthKey)).toEqual([
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ])
    // Sep '25 contribution falls inside the window but was never in `monthly` because
    // getMonthlyData already included it — confirm the window doesn't silently drop it
    expect(trailing.find((m) => m.monthKey === '2025-09')?.raised).toBe(999)
    expect(trailing.find((m) => m.monthKey === '2026-06')?.raised).toBe(75)
  })
})
