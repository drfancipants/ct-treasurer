'use client'

import { DollarSign, TrendingUp, List, AlertCircle } from 'lucide-react'
import type { Contribution } from '@/lib/types'
import { getSeecStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  contributions: Contribution[]
}

export default function DonationSummaryCards({ contributions }: Props) {
  const total = contributions.reduce((sum, c) => sum + c.amount, 0)
  const itemized = contributions.filter((c) => c.isItemized)
  const nonItemized = contributions.filter((c) => !c.isItemized)
  const needsReview = contributions.filter(
    (c) => getSeecStatus(c).status !== 'compliant'
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
        iconBg="bg-emerald-50"
        label="Total raised"
        value={formatCurrency(total)}
        sub={`${contributions.length} contributions`}
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        iconBg="bg-blue-50"
        label="Itemized"
        value={formatCurrency(itemized.reduce((s, c) => s + c.amount, 0))}
        sub={`${itemized.length} contributions`}
      />
      <StatCard
        icon={<List className="w-4 h-4 text-slate-600" />}
        iconBg="bg-slate-100"
        label="Non-itemized"
        value={formatCurrency(nonItemized.reduce((s, c) => s + c.amount, 0))}
        sub={`${nonItemized.length} contributions`}
      />
      <StatCard
        icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
        iconBg="bg-amber-50"
        label="Needs review"
        value={String(needsReview.length)}
        sub="SEEC compliance issues"
        highlight={needsReview.length > 0}
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
  highlight,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        highlight ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-900 tabular leading-none mb-1">
        {value}
      </p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  )
}
