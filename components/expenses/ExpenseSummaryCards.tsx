'use client'

import { TrendingDown, Receipt, Scale, AlertCircle } from 'lucide-react'
import type { Expenditure, Contribution } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  expenditures: Expenditure[]
  contributions?: Contribution[] // optional — enables net balance card
}

export default function ExpenseSummaryCards({ expenditures, contributions }: Props) {
  const totalSpent = expenditures.reduce((s, e) => s + e.amount, 0)
  const largest = expenditures.length
    ? Math.max(...expenditures.map((e) => e.amount))
    : 0
  const totalRaised = contributions?.reduce((s, c) => s + c.amount, 0) ?? null
  const netBalance = totalRaised !== null ? totalRaised - totalSpent : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<TrendingDown className="w-4 h-4 text-rose-600" />}
        iconBg="bg-rose-50"
        label="Total spent"
        value={formatCurrency(totalSpent)}
        sub={`${expenditures.length} ${expenditures.length === 1 ? 'expenditure' : 'expenditures'}`}
      />

      {netBalance !== null ? (
        <StatCard
          icon={<Scale className="w-4 h-4 text-slate-600" />}
          iconBg={netBalance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
          label="Net balance"
          value={formatCurrency(netBalance)}
          sub="Raised minus spent"
          valueColor={netBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}
          highlight={netBalance < 0}
        />
      ) : (
        <StatCard
          icon={<Scale className="w-4 h-4 text-slate-400" />}
          iconBg="bg-slate-100"
          label="Net balance"
          value="—"
          sub="Connect donations to see"
        />
      )}

      <StatCard
        icon={<Receipt className="w-4 h-4 text-slate-600" />}
        iconBg="bg-slate-100"
        label="Largest expense"
        value={largest > 0 ? formatCurrency(largest) : '—'}
        sub={
          largest > 0
            ? expenditures.find((e) => e.amount === largest)?.payee ?? ''
            : 'No expenses yet'
        }
      />

      <StatCard
        icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
        iconBg="bg-amber-50"
        label="Avg. per expense"
        value={expenditures.length > 0 ? formatCurrency(totalSpent / expenditures.length) : '—'}
        sub="Across all expenditures"
      />
    </div>
  )
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
  valueColor = 'text-slate-900',
  highlight = false,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  sub: string
  valueColor?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        highlight ? 'border-red-200 bg-red-50/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-semibold tabular leading-none mb-1 ${valueColor}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400 truncate">{sub}</p>
    </div>
  )
}
