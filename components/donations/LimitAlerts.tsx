'use client'

import { AlertTriangle, AlertOctagon } from 'lucide-react'
import type { Contribution } from '@/lib/types'
import { getLimitAlerts, INDIVIDUAL_ANNUAL_LIMIT } from '@/lib/limits'
import { formatCurrency, cn } from '@/lib/utils'

/**
 * Banner listing donors at or over the CT annual limit for town committees
 * ($2,000/individual/calendar year). Rendered above the donations table.
 */
export default function LimitAlerts({ contributions }: { contributions: Contribution[] }) {
  const alerts = getLimitAlerts(contributions)
  if (alerts.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      {alerts.map((d) => {
        const over = d.status === 'over'
        return (
          <div
            key={`${d.key}@${d.year}`}
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
                {d.name} — {formatCurrency(d.total)} of {formatCurrency(INDIVIDUAL_ANNUAL_LIMIT)} in {d.year}
                {over ? ' · over the annual limit' : ` · ${formatCurrency(d.remaining)} remaining`}
              </p>
              <p className={cn('mt-0.5', over ? 'text-red-700' : 'text-amber-700')}>
                {over
                  ? 'CT limits individuals to $2,000 per town committee per calendar year — the excess may need to be refunded.'
                  : 'Approaching the $2,000 individual annual limit for town committees.'}
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
