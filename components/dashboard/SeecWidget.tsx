'use client'

import Link from 'next/link'
import { CheckCircle2, AlertCircle, XCircle, ArrowRight } from 'lucide-react'
import type { SeecSummary } from '@/lib/analytics'

interface Props {
  summary: SeecSummary
  committeeSlug: string
}

export default function SeecWidget({ summary, committeeSlug }: Props) {
  const { compliant, needsReview, incomplete, total } = summary
  const hasIssues = needsReview + incomplete > 0
  const pctCompliant = total > 0 ? Math.round((compliant / total) * 100) : 100

  return (
    <div
      className={`bg-white border rounded-xl p-5 ${
        hasIssues ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">SEEC compliance</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} contribution{total !== 1 ? 's' : ''} checked · {pctCompliant}% compliant
          </p>
        </div>
        {hasIssues && (
          <Link
            href={`/app/${committeeSlug}/donations?seec=issues`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Fix issues
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className="h-full flex">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${(compliant / total) * 100}%` }}
          />
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${(needsReview / total) * 100}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(incomplete / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatusBlock
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          label="Compliant"
          count={compliant}
          color="text-emerald-700"
          bg="bg-emerald-50"
        />
        <StatusBlock
          icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
          label="Missing info"
          count={needsReview}
          color="text-amber-700"
          bg="bg-amber-50"
        />
        <StatusBlock
          icon={<XCircle className="w-4 h-4 text-red-500" />}
          label="Incomplete"
          count={incomplete}
          color="text-red-700"
          bg="bg-red-50"
        />
      </div>

      {!hasIssues && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mt-4 text-center font-medium">
          ✓ All contributions are SEEC-compliant and ready to file
        </p>
      )}
    </div>
  )
}

function StatusBlock({
  icon,
  label,
  count,
  color,
  bg,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
  bg: string
}) {
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
      <p className={`text-xl font-semibold tabular ${color}`}>{count}</p>
    </div>
  )
}
