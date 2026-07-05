'use client'

import { DollarSign, CheckCircle2, Clock, Receipt } from 'lucide-react'
import type { InKindContribution } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  contributions: InKindContribution[]
}

function donorName(r: InKindContribution): string {
  if (r.entityType === 'IS') return [r.firstName, r.lastName].filter(Boolean).join(' ')
  return r.lastName
}

export default function InKindSummaryCards({ contributions }: Props) {
  const total = contributions.reduce((sum, c) => sum + c.fairMarketValue, 0)
  const filed = contributions.filter((c) => c.filedAt)
  const notFiled = contributions.filter((c) => !c.filedAt)
  const largest = contributions.length ? Math.max(...contributions.map((c) => c.fairMarketValue)) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
        iconBg="bg-emerald-50"
        label="Total value"
        value={formatCurrency(total)}
        sub={`${contributions.length} contribution${contributions.length !== 1 ? 's' : ''}`}
      />
      <StatCard
        icon={<CheckCircle2 className="w-4 h-4 text-blue-600" />}
        iconBg="bg-blue-50"
        label="Filed"
        value={formatCurrency(filed.reduce((s, c) => s + c.fairMarketValue, 0))}
        sub={`${filed.length} contribution${filed.length !== 1 ? 's' : ''}`}
      />
      <StatCard
        icon={<Clock className="w-4 h-4 text-slate-600" />}
        iconBg="bg-slate-100"
        label="Not yet filed"
        value={formatCurrency(notFiled.reduce((s, c) => s + c.fairMarketValue, 0))}
        sub={`${notFiled.length} contribution${notFiled.length !== 1 ? 's' : ''}`}
      />
      <StatCard
        icon={<Receipt className="w-4 h-4 text-slate-600" />}
        iconBg="bg-slate-100"
        label="Largest contribution"
        value={largest > 0 ? formatCurrency(largest) : '—'}
        sub={
          largest > 0
            ? donorName(contributions.find((c) => c.fairMarketValue === largest)!)
            : 'No contributions yet'
        }
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
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-900 tabular leading-none mb-1">
        {value}
      </p>
      <p className="text-xs text-slate-400 truncate">{sub}</p>
    </div>
  )
}
