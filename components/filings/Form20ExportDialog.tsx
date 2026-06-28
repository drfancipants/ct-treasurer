'use client'

import { useState, useMemo } from 'react'
import { X, FileDown, AlertCircle, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import type { Contribution, Expenditure } from '@/lib/types'
import { previewForm20, populateForm20 } from '@/lib/form20'
import { formatCurrency } from '@/lib/utils'

// Standard CT SEEC filing periods
const FILING_PERIODS = [
  { label: 'Q1 — Jan 1 – Mar 31', start: '-01-01', end: '-03-31' },
  { label: 'Q2 — Apr 1 – Jun 30', start: '-04-01', end: '-06-30' },
  { label: 'Q3 — Jul 1 – Sep 30', start: '-07-01', end: '-09-30' },
  { label: 'Q4 — Oct 1 – Dec 31', start: '-10-01', end: '-12-31' },
]

interface Props {
  open: boolean
  onClose: () => void
  contributions: Contribution[]
  expenditures: Expenditure[]
  committeeName: string
}

export default function Form20ExportDialog({
  open,
  onClose,
  contributions,
  expenditures,
  committeeName,
}: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [periodIdx, setPeriodIdx] = useState(3) // Default Q4
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const periodStart = useCustom
    ? customStart
    : `${year}${FILING_PERIODS[periodIdx].start}`

  const periodEnd = useCustom
    ? customEnd
    : `${year}${FILING_PERIODS[periodIdx].end}`

  const preview = useMemo(
    () =>
      periodStart && periodEnd
        ? previewForm20(contributions, expenditures, periodStart, periodEnd)
        : null,
    [contributions, expenditures, periodStart, periodEnd]
  )

  const hasData =
    preview &&
    (preview.itemizedCount > 0 ||
      preview.nonItemizedCount > 0 ||
      preview.expenditureCount > 0)

  if (!open) return null

  async function handleGenerate() {
    if (!preview || !hasData) return
    setGenerating(true)
    setError('')

    try {
      // Fetch the template from the public directory
      const res = await fetch('/templates/Form_20_Upload_Template.xls')
      if (!res.ok) throw new Error('Could not load template file')
      const buffer = await res.arrayBuffer()

      // Populate the template
      const output = populateForm20(buffer, contributions, expenditures, periodStart, periodEnd)

      // Trigger download
      const blob = new Blob([output.buffer as ArrayBuffer], { type: 'application/vnd.ms-excel' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeCommittee = committeeName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
      a.href = url
      a.download = `Form20_${safeCommittee}_${periodStart}_${periodEnd}.xls`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate file')
    } finally {
      setGenerating(false)
    }
  }

  const periodLabel = useCustom
    ? `${periodStart} to ${periodEnd}`
    : `${FILING_PERIODS[periodIdx].label.split('—')[0].trim()} ${year}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Generate SEEC Form 20</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Populates the eCRIS upload template with your data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Period selection */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">Filing period</label>

            <div className="flex gap-2">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={useCustom}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={periodIdx}
                onChange={(e) => setPeriodIdx(Number(e.target.value))}
                disabled={useCustom}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
              >
                {FILING_PERIODS.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600">Use custom date range</span>
            </label>

            {useCustom && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-500 mb-1">Start date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-500 mb-1">End date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-600">
                  What will be included — <span className="text-slate-800">{periodLabel}</span>
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                <PreviewRow
                  label="Section A — Small contributions"
                  count={preview.nonItemizedCount}
                  total={preview.nonItemizedTotal}
                  note="Non-itemized (aggregate total only)"
                />
                <PreviewRow
                  label="Section B — Itemized contributions"
                  count={preview.itemizedCount}
                  total={preview.itemizedTotal}
                  note="Individual contributions, one row each"
                />
                <PreviewRow
                  label="Section P — Committee expenses"
                  count={preview.expenditureCount}
                  total={preview.expenditureTotal}
                  note="Expenses paid by committee"
                  amountColor="text-rose-700"
                />
              </div>
            </div>
          )}

          {/* SEEC issues warning */}
          {preview && preview.seecIssues.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">
                  {preview.seecIssues.length} contribution{preview.seecIssues.length !== 1 ? 's' : ''} have SEEC compliance issues
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Missing employer or occupation will be left blank in the export.
                  eCRIS may flag these rows as errors.
                </p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {preview && !hasData && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-500">
                No contributions or expenses recorded in this period.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Info note */}
          <p className="text-[11px] text-slate-400 leading-snug">
            The downloaded file uses the official eCRIS Form 20 template with Sections A, B, and P pre-filled.
            Upload it directly at <span className="font-medium">seec.ct.gov → eCRIS → Upload Report</span>.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !hasData}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><FileDown className="w-4 h-4" /> Download .xls</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewRow({
  label,
  count,
  total,
  note,
  amountColor = 'text-emerald-700',
}: {
  label: string
  count: number
  total: number
  note: string
  amountColor?: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{note}</p>
      </div>
      <div className="text-right shrink-0 ml-4">
        {count > 0 ? (
          <>
            <p className={`text-sm font-semibold tabular ${amountColor}`}>
              {formatCurrency(total)}
            </p>
            <p className="text-[10px] text-slate-400">
              {count} {count === 1 ? 'record' : 'records'}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">None</p>
        )}
      </div>
    </div>
  )
}
