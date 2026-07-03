import { format, parseISO } from 'date-fns'
import type { Contribution, Expenditure, RosterMember } from './types'
import { getSeecStatus, EXPENSE_CATEGORY_LABELS } from './types'

// ─── Monthly raised vs spent ──────────────────────────────────────────────────

export interface MonthlyData {
  month: string    // "Sep '24"
  monthKey: string // "2024-09"
  raised: number
  spent: number
  net: number
}

export function getMonthlyData(
  contributions: Contribution[],
  expenditures: Expenditure[]
): MonthlyData[] {
  const months = new Set<string>()
  const raisedMap = new Map<string, number>()
  const spentMap = new Map<string, number>()

  for (const c of contributions) {
    const key = c.date.slice(0, 7)
    months.add(key)
    raisedMap.set(key, (raisedMap.get(key) ?? 0) + c.amount)
  }
  for (const e of expenditures) {
    const key = e.date.slice(0, 7)
    months.add(key)
    spentMap.set(key, (spentMap.get(key) ?? 0) + e.amount)
  }

  return Array.from(months)
    .sort()
    .map((key) => ({
      month: format(parseISO(`${key}-01`), "MMM ''yy"),
      monthKey: key,
      raised: raisedMap.get(key) ?? 0,
      spent: spentMap.get(key) ?? 0,
      net: (raisedMap.get(key) ?? 0) - (spentMap.get(key) ?? 0),
    }))
}

// ─── Cumulative running balance ───────────────────────────────────────────────

export interface CumulativePoint {
  month: string
  totalRaised: number
  totalSpent: number
  balance: number
}

export function getCumulativeData(monthly: MonthlyData[]): CumulativePoint[] {
  let totalRaised = 0
  let totalSpent = 0
  return monthly.map((m) => {
    totalRaised += m.raised
    totalSpent += m.spent
    return {
      month: m.month,
      totalRaised,
      totalSpent,
      balance: totalRaised - totalSpent,
    }
  })
}

// ─── Roster dues status ────────────────────────────────────────────────────────

export interface DuesStatusData {
  name: string
  value: number
}

export function getDuesStatusBreakdown(rosterMembers: RosterMember[]): DuesStatusData[] {
  const paid = rosterMembers.filter((m) => m.duesPaid).length
  const unpaid = rosterMembers.length - paid
  return [
    { name: 'Paid', value: paid },
    { name: 'Not paid', value: unpaid },
  ]
}

// ─── Expense category breakdown ───────────────────────────────────────────────

export interface CategoryData {
  name: string
  amount: number
  count: number
}

export function getExpenseCategoryBreakdown(expenditures: Expenditure[]): CategoryData[] {
  const map = new Map<string, { amount: number; count: number }>()
  for (const e of expenditures) {
    const label = EXPENSE_CATEGORY_LABELS[e.category] ?? e.category
    const existing = map.get(label) ?? { amount: 0, count: 0 }
    map.set(label, { amount: existing.amount + e.amount, count: existing.count + 1 })
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
}

// ─── SEEC compliance summary ──────────────────────────────────────────────────

export interface SeecSummary {
  compliant: number
  needsReview: number
  incomplete: number
  total: number
}

export function getSeecSummary(contributions: Contribution[]): SeecSummary {
  const summary = { compliant: 0, needsReview: 0, incomplete: 0, total: contributions.length }
  for (const c of contributions) {
    const { status } = getSeecStatus(c)
    if (status === 'compliant') summary.compliant++
    else if (status === 'missing_info') summary.needsReview++
    else summary.incomplete++
  }
  return summary
}

// ─── Recent activity ──────────────────────────────────────────────────────────

export type ActivityItem =
  | { kind: 'contribution'; id: string; date: string; label: string; amount: number }
  | { kind: 'expenditure'; id: string; date: string; label: string; amount: number }

export function getRecentActivity(
  contributions: Contribution[],
  expenditures: Expenditure[],
  limit = 8
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...contributions.map((c) => ({
      kind: 'contribution' as const,
      id: c.id,
      date: c.date,
      label: `${c.contributor.firstName} ${c.contributor.lastName}`,
      amount: c.amount,
    })),
    ...expenditures.map((e) => ({
      kind: 'expenditure' as const,
      id: e.id,
      date: e.date,
      label: e.payee,
      amount: e.amount,
    })),
  ]
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}
