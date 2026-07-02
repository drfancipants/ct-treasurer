'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { ActivityItem } from '@/lib/analytics'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  items: ActivityItem[]
  committeeSlug: string
}

export default function RecentActivity({ items, committeeSlug }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
          <p className="text-xs text-slate-500 mt-0.5">Latest contributions and expenses</p>
        </div>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-10">
          No activity yet — your latest donations and expenses will show up here
        </p>
      )}

      <div className="space-y-1">
        {items.map((item) => {
          const isContribution = item.kind === 'contribution'
          return (
            <div
              key={`${item.kind}-${item.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors -mx-3"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  isContribution ? 'bg-emerald-50' : 'bg-rose-50'
                }`}
              >
                {isContribution ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{item.label}</p>
                <p className="text-[10px] text-slate-400">{formatDate(item.date)}</p>
              </div>
              <span
                className={`text-xs font-semibold tabular shrink-0 ${
                  isContribution ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isContribution ? '+' : '-'}{formatCurrency(item.amount)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
        <Link
          href={`/app/${committeeSlug}/donations`}
          className="flex-1 text-center text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          All donations →
        </Link>
        <Link
          href={`/app/${committeeSlug}/expenses`}
          className="flex-1 text-center text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          All expenses →
        </Link>
      </div>
    </div>
  )
}

