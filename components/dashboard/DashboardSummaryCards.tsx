'use client'

import { TrendingUp, TrendingDown, Scale, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { SeecSummary } from '@/lib/analytics'

interface Props {
  totalRaised: number
  totalSpent: number
  seec: SeecSummary
  contributionCount: number
  expenditureCount: number
}

export default function DashboardSummaryCards({
  totalRaised,
  totalSpent,
  seec,
  contributionCount,
  expenditureCount,
}: Props) {
  const balance = totalRaised - totalSpent
  const balancePositive = balance >= 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Net balance"
        value={formatCurrency(balance)}
        sub={balancePositive ? 'Ahead of spending' : 'Spending exceeds income'}
        valueColor={balancePositive ? 'text-emerald-700' : 'text-red-700'}
        iconBg={balancePositive ? 'bg-emerald-50' : 'bg-red-50'}
        icon={<Scale className={`w-4 h-4 ${balancePositive ? 'text-emerald-600' : 'text-red-600'}`} />}
        highlight={!balancePositive}
      />
      <Card
        label="Total raised"
        value={formatCurrency(totalRaised)}
        sub={`${contributionCount} contributions`}
        valueColor="text-emerald-700"
        iconBg="bg-emerald-50"
        icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
      />
      <Card
        label="Total spent"
        value={formatCurrency(totalSpent)}
        sub={`${expenditureCount} expenditures`}
        valueColor="text-rose-700"
        iconBg="bg-rose-50"
        icon={<TrendingDown className="w-4 h-4 text-rose-600" />}
      />
      <Card
        label="SEEC issues"
        value={String(seec.needsReview + seec.incomplete)}
        sub={
          seec.needsReview + seec.incomplete === 0
            ? 'All contributions compliant'
            : `${seec.incomplete} incomplete · ${seec.needsReview} need info`
        }
        valueColor={seec.needsReview + seec.incomplete > 0 ? 'text-amber-700' : 'text-slate-700'}
        iconBg={seec.needsReview + seec.incomplete > 0 ? 'bg-amber-50' : 'bg-slate-100'}
        icon={
          <AlertCircle
            className={`w-4 h-4 ${seec.needsReview + seec.incomplete > 0 ? 'text-amber-600' : 'text-slate-400'}`}
          />
        }
        highlight={seec.needsReview + seec.incomplete > 0}
      />
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  valueColor,
  iconBg,
  icon,
  highlight,
}: {
  label: string
  value: string
  sub: string
  valueColor: string
  iconBg: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        highlight ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-semibold tabular leading-none mb-1 ${valueColor}`}>{value}</p>
      <p className="text-xs text-slate-400 leading-snug">{sub}</p>
    </div>
  )
}
