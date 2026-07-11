'use client'

import { useState, useMemo } from 'react'
import { X, FileDown, AlertCircle, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import type { Contribution, Expenditure, CommitteeEvent, CommitteeContribution, InKindContribution, Reimbursement } from '@/lib/types'
import { populateForm20 } from '@/lib/form20'
import { populateForm30 } from '@/lib/form30'
import { previewFiling, FORM_SECTIONS } from '@/lib/seec-export'
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
  events: CommitteeEvent[]
  committeeContributions: CommitteeContribution[]
  inKindContributions: InKindContribution[]
  reimbursements: Reimbursement[]
  committeeName: string
  /**
   * Which SEEC disclosure form this committee files: 20 (party committees,
   * municipal & probate candidate committees — full .xls export) or 30
   * (statewide & General Assembly candidate committees — period summary to
   * key into eCRIS, until the Form 30 upload template is bundled).
   */
  formNumber?: 20 | 30
  initialPeriod?: { start: string; end: string }
  onFiled?: (start: string, end: string) => void
}

/**
 * Only a period that starts and ends exactly on a standard quarter's
 * boundary (regardless of year) can be represented by the year/quarter
 * dropdowns — anything else (a custom pre-election filing, or a quarter
 * split around one) must be treated as a custom date range, or the dialog
 * would silently substitute the wrong quarter's data (e.g. a period
 * starting in May falling through to "assume Q4").
 */
function matchStandardQuarter(start: string, end: string): { year: string; periodIdx: number } | null {
  const year = start.slice(0, 4)
  const idx = FILING_PERIODS.findIndex((q) => start === `${year}${q.start}` && end === `${year}${q.end}`)
  return idx === -1 ? null : { year, periodIdx: idx }
}

export default function FilingExportDialog({
  open,
  onClose,
  contributions,
  expenditures,
  events,
  committeeContributions,
  inKindContributions,
  reimbursements,
  committeeName,
  formNumber = 20,
  initialPeriod,
  onFiled,
}: Props) {
  const currentYear = new Date().getFullYear()
  const initialQuarterMatch = initialPeriod ? matchStandardQuarter(initialPeriod.start, initialPeriod.end) : null
  const [year, setYear] = useState(initialQuarterMatch?.year ?? String(currentYear))
  const [periodIdx, setPeriodIdx] = useState(initialQuarterMatch?.periodIdx ?? 3)
  const [customStart, setCustomStart] = useState(
    !initialQuarterMatch && initialPeriod ? initialPeriod.start : ''
  )
  const [customEnd, setCustomEnd] = useState(
    !initialQuarterMatch && initialPeriod ? initialPeriod.end : ''
  )
  const [useCustom, setUseCustom] = useState(!initialQuarterMatch && !!initialPeriod)
  const [generating, setGenerating] = useState(false)
  const [markingFiled, setMarkingFiled] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState('')
  // Form 30's eCRIS upload template isn't published outside a login, so if it
  // isn't bundled we fall back to a "key it into eCRIS from this summary" mode.
  const [summaryOnly, setSummaryOnly] = useState(false)

  const sections = FORM_SECTIONS[formNumber]
  const templatePath = `/templates/Form_${formNumber}_Upload_Template.xls`

  const periodStart = useCustom
    ? customStart
    : `${year}${FILING_PERIODS[periodIdx].start}`

  const periodEnd = useCustom
    ? customEnd
    : `${year}${FILING_PERIODS[periodIdx].end}`

  const preview = useMemo(
    () =>
      periodStart && periodEnd
        ? previewFiling(contributions, expenditures, periodStart, periodEnd, events, committeeContributions, inKindContributions, reimbursements)
        : null,
    [contributions, expenditures, events, committeeContributions, inKindContributions, reimbursements, periodStart, periodEnd]
  )

  const hasData =
    preview &&
    (preview.itemizedCount > 0 ||
      preview.nonItemizedCount > 0 ||
      preview.expenditureCount > 0 ||
      preview.eventCount > 0 ||
      preview.committeeContribCount > 0 ||
      preview.inKindCount > 0 ||
      preview.reimbursementCount > 0)

  if (!open) return null

  async function handleGenerate() {
    if (!preview || !hasData) return
    setGenerating(true)
    setError('')

    try {
      // Fetch the template from the public directory
      const res = await fetch(templatePath)
      if (!res.ok) {
        // Template not bundled — fall back to the on-screen summary so the
        // treasurer can key the figures into eCRIS by hand.
        setSummaryOnly(true)
        return
      }
      const buffer = await res.arrayBuffer()

      const populate = formNumber === 30 ? populateForm30 : populateForm20
      const output = populate(buffer, contributions, expenditures, periodStart, periodEnd, events, committeeContributions, inKindContributions, reimbursements)

      // Trigger download
      const blob = new Blob([new Uint8Array(output).buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeCommittee = committeeName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
      a.href = url
      a.download = `Form${formNumber}_${safeCommittee}_${periodStart}_${periodEnd}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setDownloaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate file')
    } finally {
      setGenerating(false)
    }
  }

  async function handleMarkFiled() {
    if (!onFiled) return
    setMarkingFiled(true)
    try {
      await onFiled(periodStart, periodEnd)
      onClose()
    } finally {
      setMarkingFiled(false)
    }
  }

  const periodLabel = useCustom
    ? `${periodStart} to ${periodEnd}`
    : `${FILING_PERIODS[periodIdx].label.split('—')[0].trim()} ${year}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Generate SEEC Form {formNumber}</h2>
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

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
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
                  label={`Section ${sections.small} — Small contributions`}
                  count={preview.nonItemizedCount}
                  total={preview.nonItemizedTotal}
                  note="Non-itemized (aggregate total only)"
                />
                <PreviewRow
                  label={`Section ${sections.itemized} — Itemized contributions`}
                  count={preview.itemizedCount}
                  total={preview.itemizedTotal}
                  note="Individual contributions, one row each"
                />
                <PreviewRow
                  label={`Section ${sections.expenses} — Committee expenses`}
                  count={preview.expenditureCount}
                  total={preview.expenditureTotal}
                  note="Expenses paid by committee"
                  amountColor="text-rose-700"
                />
                <PreviewRow
                  label={`Section ${sections.committee} — Contributions from committees`}
                  count={preview.committeeContribCount}
                  total={preview.committeeContribTotal}
                  note="Received from other committees"
                />
                <PreviewRow
                  label={`Section ${sections.inKind} — In-kind contributions`}
                  count={preview.inKindCount}
                  total={preview.inKindTotal}
                  note="Goods/services (fair market value)"
                />
                <PreviewRow
                  label={`Section ${sections.reimbursements} — Worker reimbursements`}
                  count={preview.reimbursementCount}
                  total={preview.reimbursementTotal}
                  note="Out-of-pocket payments by workers"
                  amountColor="text-rose-700"
                />
                <PreviewRow
                  label={`Section ${sections.events} — Fundraising events`}
                  count={preview.eventCount}
                  total={preview.eventTotal}
                  note="Event details & food/tag-sale receipts"
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
            The downloaded file uses the official eCRIS Form {formNumber} template with Sections{' '}
            {sections.small}, {sections.itemized}, {sections.committee}, {sections.events},{' '}
            {sections.inKind}, {sections.expenses}, and {sections.reimbursements} pre-filled.
            Upload it directly at <span className="font-medium">seec.ct.gov → eCRIS → Upload Report</span>.
          </p>
        </div>

        {/* Footer */}
        {downloaded || summaryOnly ? (
          <div className="px-6 py-4 border-t border-slate-200 bg-emerald-50 rounded-b-2xl space-y-3 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-800">
                {summaryOnly ? 'Summary ready' : 'File downloaded successfully'}
              </p>
            </div>
            <p className="text-xs text-emerald-700">
              {summaryOnly
                ? 'Enter these section totals into your Form 30 in eCRIS, then mark this period as filed.'
                : 'Upload it to eCRIS at seec.ct.gov → Upload Report, then mark this period as filed.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-emerald-200 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Close
              </button>
              {onFiled && (
                <button
                  onClick={handleMarkFiled}
                  disabled={markingFiled}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {markingFiled ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Mark as filed</>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
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
                <><FileDown className="w-4 h-4" /> Download .xlsx</>
              )}
            </button>
          </div>
        )}
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
