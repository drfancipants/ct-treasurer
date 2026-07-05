import { describe, it, expect } from 'vitest'
import { generateQuarterlyPeriods, mergeFilingPeriods, type FilingPeriod } from '../filing-periods'
import type { CustomFilingPeriodRecord } from '@/actions/filings'

const TODAY = new Date('2026-07-05T12:00:00Z')

describe('generateQuarterlyPeriods', () => {
  it('excludes quarters that have not started yet', () => {
    const periods = generateQuarterlyPeriods(2026, TODAY)
    expect(periods.some((p) => p.label.startsWith('Q4 2026'))).toBe(false)
    expect(periods.some((p) => p.label.startsWith('Q3 2026'))).toBe(true)
  })

  it('orders periods newest-first', () => {
    const periods = generateQuarterlyPeriods(2026, TODAY)
    const starts = periods.map((p) => p.start)
    const sorted = [...starts].sort().reverse()
    expect(starts).toEqual(sorted)
  })

  it('defaults to starting the year before today when no election year is given', () => {
    const periods = generateQuarterlyPeriods(undefined, TODAY)
    const years = periods.map((p) => Number(p.start.slice(0, 4)))
    expect(Math.min(...years)).toBe(2025)
  })

  it('starts from the election year when it is earlier than last year', () => {
    const periods = generateQuarterlyPeriods(2023, TODAY)
    const years = periods.map((p) => Number(p.start.slice(0, 4)))
    expect(Math.min(...years)).toBe(2023)
  })

  it('does not let a future election year push the start date forward', () => {
    // electionYear is combined with (currentYear - 1) via Math.min, so a
    // later election year must not override the normal one-year lookback.
    const periods = generateQuarterlyPeriods(2030, TODAY)
    const years = periods.map((p) => Number(p.start.slice(0, 4)))
    expect(Math.min(...years)).toBe(2025)
  })

  it('rolls Q4 due dates into the following calendar year', () => {
    const periods = generateQuarterlyPeriods(2026, TODAY)
    const q4 = periods.find((p) => p.label.startsWith('Q4 2025'))
    expect(q4?.due).toBe('Jan 10, 2026')
  })

  it('gives each generated period matching start/end year boundaries', () => {
    const periods = generateQuarterlyPeriods(2026, TODAY)
    const q3 = periods.find((p) => p.label.startsWith('Q3 2026'))
    expect(q3).toMatchObject({ start: '2026-07-01', end: '2026-09-30', due: 'Oct 10, 2026' })
  })
})

function customPeriod(overrides: Partial<CustomFilingPeriodRecord> = {}): CustomFilingPeriodRecord {
  return {
    id: 'custom_1',
    label: 'Pre-election filing',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    dueDate: 'Sep 5, 2026',
    ...overrides,
  }
}

const Q3_2026: FilingPeriod = {
  label: 'Q3 2026 — Jul 1 – Sep 30',
  start: '2026-07-01',
  end: '2026-09-30',
  due: 'Oct 10, 2026',
}

describe('mergeFilingPeriods', () => {
  it('returns the base periods unchanged (but sorted) when there are no custom periods', () => {
    const merged = mergeFilingPeriods([Q3_2026], [])
    expect(merged).toEqual([Q3_2026])
  })

  it('splits a quarter into before/after remainder pieces around a fully-contained custom period', () => {
    const merged = mergeFilingPeriods([Q3_2026], [customPeriod()])

    expect(merged).toHaveLength(3)
    const custom = merged.find((p) => p.isCustom)
    const before = merged.find((p) => p.start === '2026-07-01')
    const after = merged.find((p) => p.end === '2026-09-30' && !p.isCustom)

    expect(custom).toMatchObject({ start: '2026-08-01', end: '2026-08-31', customId: 'custom_1' })
    expect(before).toMatchObject({ end: '2026-07-31' })
    expect(before?.label).toContain('(part)')
    expect(after).toMatchObject({ start: '2026-09-01' })
    expect(after?.label).toContain('(part)')
    // The due date is the original quarter's SEEC deadline — it doesn't move
    // just because part of the quarter was carved out and filed separately.
    expect(before?.due).toBe('Oct 10, 2026')
    expect(after?.due).toBe('Oct 10, 2026')
  })

  it('produces only one remainder piece when the custom period starts exactly on the quarter boundary', () => {
    const merged = mergeFilingPeriods([Q3_2026], [
      customPeriod({ periodStart: '2026-07-01', periodEnd: '2026-08-15' }),
    ])
    expect(merged).toHaveLength(2)
    expect(merged.some((p) => p.label.includes('(part)') && p.start === '2026-07-01')).toBe(false)
    const after = merged.find((p) => !p.isCustom)
    expect(after).toMatchObject({ start: '2026-08-16', end: '2026-09-30' })
  })

  it('produces only one remainder piece when the custom period ends exactly on the quarter boundary', () => {
    const merged = mergeFilingPeriods([Q3_2026], [
      customPeriod({ periodStart: '2026-08-15', periodEnd: '2026-09-30' }),
    ])
    expect(merged).toHaveLength(2)
    const before = merged.find((p) => !p.isCustom)
    expect(before).toMatchObject({ start: '2026-07-01', end: '2026-08-14' })
  })

  it('leaves quarters the custom period does not touch untouched', () => {
    const q2: FilingPeriod = { label: 'Q2 2026 — Apr 1 – Jun 30', start: '2026-04-01', end: '2026-06-30', due: 'Jul 10, 2026' }
    const merged = mergeFilingPeriods([Q3_2026, q2], [customPeriod()])
    expect(merged.find((p) => p.label === q2.label)).toEqual(q2)
  })

  it('sorts the merged result newest-first, interleaving the custom period correctly', () => {
    const q2: FilingPeriod = { label: 'Q2 2026 — Apr 1 – Jun 30', start: '2026-04-01', end: '2026-06-30', due: 'Jul 10, 2026' }
    const merged = mergeFilingPeriods([Q3_2026, q2], [customPeriod()])
    const starts = merged.map((p) => p.start)
    const sorted = [...starts].sort().reverse()
    expect(starts).toEqual(sorted)
  })

  it('applies multiple custom periods cumulatively', () => {
    const merged = mergeFilingPeriods([Q3_2026], [
      customPeriod({ id: 'c1', label: 'First custom', periodStart: '2026-07-10', periodEnd: '2026-07-20' }),
      customPeriod({ id: 'c2', label: 'Second custom', periodStart: '2026-08-10', periodEnd: '2026-08-20' }),
    ])
    const customIds = merged.filter((p) => p.isCustom).map((p) => p.customId)
    expect(customIds.sort()).toEqual(['c1', 'c2'])
    // Original quarter is now split into three remainder pieces around the two custom periods
    expect(merged.filter((p) => !p.isCustom)).toHaveLength(3)
  })
})
