'use client'

import { AlertTriangle, AlertOctagon } from 'lucide-react'
import type { Contribution } from '@/lib/types'
import { getLimitAlerts, PARTY_POLICY, type LimitPolicy } from '@/lib/limits'
import { formatCurrency, cn } from '@/lib/utils'

/**
 * Banner listing donors at or over the applicable CT individual limit —
 * $2,000/calendar year for town committees, or the office-based per-phase (or
 * CEP cycle) limit for candidate committees. Rendered above the donations table.
 */
export default function LimitAlerts({
  contributions,
  policy = PARTY_POLICY,
}: {
  contributions: Contribution[]
  policy?: LimitPolicy
}) {
  const alerts = getLimitAlerts(contributions, undefined, policy)
  if (alerts.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      {alerts.map((d) => {
        const over = d.status === 'over'
        return (
          <div
            key={`${d.key}@${d.bucket}`}
            className={cn(
              'flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs',
              over ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            )}
          >
            {over
              ? <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
            <div>
              <p className={cn('font-medium', over ? 'text-red-800' : 'text-amber-800')}>
                {d.name} — {formatCurrency(d.total)} of {formatCurrency(d.total + d.remaining)}{' '}
                {policy.kind === 'PARTY' ? `in ${d.bucketLabel}` : `for the ${d.bucketLabel.toLowerCase()}`}
                {over ? ' · over the limit' : ` · ${formatCurrency(d.remaining)} remaining`}
              </p>
              <p className={cn('mt-0.5', over ? 'text-red-700' : 'text-amber-700')}>
                {over
                  ? `CT limits individuals to ${policy.limitLabel} — the excess may need to be refunded.`
                  : `Approaching the ${policy.limitLabel} individual limit.`}
                {d.contributorIds.length > 1 &&
                  ` Counted across ${d.contributorIds.length} donor records that appear to be the same person.`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
