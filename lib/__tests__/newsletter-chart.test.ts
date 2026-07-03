import { describe, it, expect } from 'vitest'
import { renderContributionsChart } from '../newsletter-chart'
import { getMonthlyData, getTrailingMonths } from '../analytics'
import { makeContribution } from './helpers'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

describe('renderContributionsChart', () => {
  it('renders a valid PNG buffer for real contribution data', async () => {
    const monthly = getTrailingMonths(
      getMonthlyData([makeContribution({ date: '2026-05-15', amount: 100 })], [])
    )
    const buffer = await renderContributionsChart(monthly)
    expect(buffer.subarray(0, 4)).toEqual(PNG_MAGIC)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('renders a valid PNG even with all-zero months', async () => {
    const monthly = getTrailingMonths(getMonthlyData([], []))
    const buffer = await renderContributionsChart(monthly)
    expect(buffer.subarray(0, 4)).toEqual(PNG_MAGIC)
  })
})
