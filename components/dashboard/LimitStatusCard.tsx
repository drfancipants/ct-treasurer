'use client'

import type { Contribution } from '@/lib/types'
import { getDonorYearTotals, type LimitPolicy } from '@/lib/limits'
import { formatCurrency, cn } from '@/lib/utils'
import ChartEmptyState from './ChartEmptyState'

/**
 * Candidate-committee counterpart to the party committee's dues donut: the
 * donors closest to the applicable individual limit, with a progress bar per
 * aggregation bucket (primary / election, or CEP cycle). Pure render over the
 * contributions the dashboard already fetched.
 */
export default function LimitStatusCard({
  contributions,
  policy,
}: {
  contributions: Contribution[]
  policy: LimitPolicy
}) {
  const top = getDonorYearTotals(contributions, policy).slice(0, 5)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Contribution limits</h3>
        <p className="text-xs text-slate-500 mt-0.5">Top donors vs the {policy.limitLabel} limit</p>
      </div>

      {top.length === 0 ? (
        <ChartEmptyState height={160} message="Donor limit status appears once you record contributions" />
      ) : (
        <div className="space-y-3">
          {top.map((d) => {
            const pct = Math.min(100, Math.round((d.total / policy.individualLimit) * 100))
            const color =
              d.status === 'over' ? 'bg-red-500' : d.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <div key={`${d.key}@${d.bucket}`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-700 truncate mr-2">
                    {d.name}
                    {policy.kind !== 'PARTY' && (
                      <span className="text-slate-400"> · {d.bucketLabel}</span>
                    )}
                  </span>
                  <span className={cn('tabular shrink-0', d.status === 'over' ? 'text-red-600 font-medium' : 'text-slate-500')}>
                    {formatCurrency(d.total)} / {formatCurrency(policy.individualLimit)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
