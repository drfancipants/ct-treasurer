'use client'

import { useState } from 'react'
import { FileText, Download, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import {
  MOCK_CONTRIBUTIONS,
  MOCK_EXPENDITURES,
  getCommittee,
} from '@/lib/mock-data'
import Form20ExportDialog from '@/components/filings/Form20ExportDialog'
import { formatCurrency } from '@/lib/utils'

// Standard CT SEEC Form 20 filing periods
const PERIODS = [
  {
    label: 'Q4 2024 — Oct 1 – Dec 31',
    start: '2024-10-01',
    end: '2024-12-31',
    due: 'Jan 10, 2025',
    status: 'ready' as const,
  },
  {
    label: 'Q3 2024 — Jul 1 – Sep 30',
    start: '2024-07-01',
    end: '2024-09-30',
    due: 'Oct 10, 2024',
    status: 'filed' as const,
  },
  {
    label: 'Q2 2024 — Apr 1 – Jun 30',
    start: '2024-04-01',
    end: '2024-06-30',
    due: 'Jul 10, 2024',
    status: 'filed' as const,
  },
]

const STATUS_CONFIG = {
  ready: {
    icon: Clock,
    label: 'Ready to file',
    color: 'text-amber-700 bg-amber-50 ring-amber-200',
  },
  filed: {
    icon: CheckCircle2,
    label: 'Filed',
    color: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  },
  issues: {
    icon: AlertCircle,
    label: 'Has issues',
    color: 'text-red-700 bg-red-50 ring-red-200',
  },
}

export default function FilingsPage({ params }: { params: { committeeSlug: string } }) {
  const committee = getCommittee(params.committeeSlug)
  const committeeId = committee?.id ?? ''
  const contributions = MOCK_CONTRIBUTIONS.filter((c) => c.committeeId === committeeId)
  const expenditures = MOCK_EXPENDITURES.filter((e) => e.committeeId === committeeId)

  const [exportPeriod, setExportPeriod] = useState<{ start: string; end: string } | null>(null)

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">SEEC Filings</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Generate Form 20 uploads for eCRIS · SEEC ID:{' '}
              <span className="font-mono text-slate-700">{committee?.seecId ?? '—'}</span>
            </p>
          </div>
          <a
            href="https://seec.ct.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Open eCRIS ↗
          </a>
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-2">How to file</p>
          <ol className="space-y-1">
            {[
              'Click "Generate Form 20" for the filing period below',
              'Download the .xls file — it\'s pre-filled with your contributions and expenses',
              'Log in to eCRIS at seec.ct.gov and select your filing period',
              'Click "Upload Report" and select the downloaded file',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Filing periods */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Filing periods
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {PERIODS.map((period) => {
              const cfg = STATUS_CONFIG[period.status]
              const Icon = cfg.icon

              // Quick stats for this period
              const periodContribs = contributions.filter(
                (c) => c.date >= period.start && c.date <= period.end
              )
              const periodExpends = expenditures.filter(
                (e) => e.date >= period.start && e.date <= period.end
              )
              const totalRaised = periodContribs.reduce((s, c) => s + c.amount, 0)
              const totalSpent = periodExpends.reduce((s, e) => s + e.amount, 0)

              return (
                <div
                  key={period.start}
                  className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{period.label}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500">
                          Due {period.due}
                        </span>
                        {totalRaised > 0 && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-emerald-700">
                              +{formatCurrency(totalRaised)} raised
                            </span>
                          </>
                        )}
                        {totalSpent > 0 && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-rose-700">
                              ({formatCurrency(totalSpent)}) spent
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${cfg.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <button
                      onClick={() =>
                        setExportPeriod({ start: period.start, end: period.end })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Generate Form 20
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sections reference */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            What gets exported
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { section: 'A', desc: 'Small contributor total', detail: 'Non-itemized donations (aggregate)' },
              { section: 'B', desc: 'Itemized contributions', detail: 'Individual donors with full address + employer' },
              { section: 'P', desc: 'Committee expenses', detail: 'All expenditures with SEEC purpose codes' },
            ].map((s) => (
              <div key={s.section} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {s.section}
                  </span>
                  <p className="text-xs font-medium text-slate-700">{s.desc}</p>
                </div>
                <p className="text-[11px] text-slate-500">{s.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            All other sections (C1, D, E, M, R, S, T…) are included in the file as empty sheets.
            Fill them manually in Excel if needed before uploading.
          </p>
        </div>
      </div>

      {exportPeriod && committee && (
        <Form20ExportDialog
          open
          onClose={() => setExportPeriod(null)}
          contributions={contributions}
          expenditures={expenditures}
          committeeName={committee.name}
        />
      )}
    </div>
  )
}
