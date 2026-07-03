'use client'

import { useState, useRef } from 'react'
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  Copy,
} from 'lucide-react'
import type { Contribution } from '@/lib/types'
import { parseAnedotCsv, type ParseResult, type ParsedRow } from '@/lib/anedot-csv'
import { importContributions } from '@/actions/donations'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

type Step = 'upload' | 'preview' | 'confirm' | 'done'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (contributions: Contribution[]) => void
  existingContributions: Contribution[]
  committeeId: string
  committeeSlug: string
}

export default function AnedotImportDialog({
  open,
  onClose,
  onImport,
  existingContributions,
  committeeId,
  committeeSlug,
}: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function reset() {
    setStep('upload')
    setDragging(false)
    setFileName('')
    setParseResult(null)
    setImporting(false)
    setImportError('')
    setImportedCount(0)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a .csv file')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseAnedotCsv(text, existingContributions)
      setParseResult(result)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function handleImport() {
    if (!parseResult) return
    setImporting(true)
    setImportError('')

    try {
      const { contributions } = await importContributions(committeeId, parseResult.rows, committeeSlug)
      setImportedCount(contributions.length)
      onImport(contributions)
    } catch {
      setImportError('Import failed — nothing was saved. Please try again.')
      setImporting(false)
      return
    }

    setStep('done')
    setImporting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'upload' && step !== 'done' && (
              <button
                onClick={() => setStep(step === 'confirm' ? 'preview' : 'upload')}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900">Import from Anedot</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 'upload' && 'Upload a CSV exported from your Anedot account'}
                {step === 'preview' && `${parseResult?.rows.length ?? 0} rows found in ${fileName}`}
                {step === 'confirm' && 'Review before importing'}
                {step === 'done' && 'Import complete'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StepIndicator current={step} />
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <UploadStep
              dragging={dragging}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            />
          )}

          {step === 'preview' && parseResult && (
            <PreviewStep result={parseResult} />
          )}

          {step === 'confirm' && parseResult && (
            <ConfirmStep result={parseResult} />
          )}

          {step === 'done' && (
            <DoneStep count={importedCount} onClose={handleClose} />
          )}
        </div>

        {/* Footer */}
        {step !== 'done' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            {step === 'preview' && parseResult && (
              <button
                onClick={() => setStep('confirm')}
                disabled={parseResult.importableCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Review import
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 'confirm' && parseResult && (
              <div className="flex items-center gap-3">
                {importError && (
                  <span className="flex items-center gap-1.5 text-xs text-red-600">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    {importError}
                  </span>
                )}
                <button
                  onClick={handleImport}
                  disabled={importing || parseResult.importableCount === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Importing…' : `Import ${parseResult.importableCount} donations`}
                </button>
              </div>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  )
}

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

function UploadStep({
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  dragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
}) {
  return (
    <div className="p-6 space-y-5">
      {/* Dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-12 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
        )}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
          <Upload className="w-6 h-6 text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {dragging ? 'Drop your CSV here' : 'Drag & drop your Anedot CSV'}
          </p>
          <p className="text-xs text-slate-400 mt-1">or click to browse · .csv files only</p>
        </div>
      </div>

      {/* How to export instructions */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-700 mb-2.5">How to export from Anedot</p>
        <ol className="space-y-1.5">
          {[
            'Log in to your Anedot account',
            'Go to Reports → Donations',
            'Set your date range and click Export',
            'Choose CSV format and download',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Format note */}
      <p className="text-xs text-slate-400 text-center">
        The importer auto-detects Anedot&apos;s column format and checks for SEEC compliance issues.
        Donations already in the system are skipped automatically.
      </p>
    </div>
  )
}

// ─── Step 2: Preview ──────────────────────────────────────────────────────────

function PreviewStep({ result }: { result: ParseResult }) {
  const { rows, formatDetected, importableCount, duplicateCount, seecIssueCount, limitIssueCount, errorCount } = result

  const previewRows = rows.slice(0, 25)

  return (
    <div className="p-6 space-y-4">
      {/* Format detection banner */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium',
        formatDetected
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700'
      )}>
        {formatDetected
          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Anedot format detected — all columns mapped automatically</>
          : <><AlertCircle className="w-3.5 h-3.5" /> Custom CSV format — verify columns below</>
        }
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <Pill color="emerald" label={`${importableCount} to import`} value={formatCurrency(result.totalAmount)} />
        {duplicateCount > 0 && <Pill color="slate" label={`${duplicateCount} already imported`} value="Skipping" />}
        {seecIssueCount > 0 && <Pill color="amber" label={`${seecIssueCount} SEEC issues`} value="Will flag" />}
        {limitIssueCount > 0 && <Pill color="red" label={`${limitIssueCount} over contribution limit`} value="Review" />}
        {errorCount > 0 && <Pill color="red" label={`${errorCount} errors`} value="Skipping" />}
      </div>

      {/* Preview table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Row</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Donor</th>
                <th className="px-3 py-2.5 text-right font-medium text-slate-500 whitespace-nowrap">Amount</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.map((row) => (
                <tr key={row.rowIndex} className={cn(
                  'transition-colors',
                  row.isError || row.isDuplicate ? 'opacity-50' : 'hover:bg-slate-50'
                )}>
                  <td className="px-3 py-2.5 text-slate-400 tabular">{row.rowIndex}</td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {row.date ? formatDate(row.date) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-slate-800">
                      {row.firstName} {row.lastName}
                    </span>
                    {row.email && (
                      <span className="text-slate-400 ml-1">· {row.email}</span>
                    )}
                    {(row.phone || row.memo) && (
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        {[row.phone, row.memo].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular font-medium text-emerald-700">
                    {row.isError ? '—' : formatCurrency(row.amount)}
                  </td>
                  <td className="px-3 py-2.5">
                    <RowStatusBadge row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 25 && (
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
            Showing 25 of {rows.length} rows
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({ result }: { result: ParseResult }) {
  const { importableCount, totalAmount, duplicateCount, seecIssueCount, limitIssueCount, errorCount } = result

  return (
    <div className="p-6 space-y-4">
      {/* Main summary card */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Ready to import {importableCount} donation{importableCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {formatCurrency(totalAmount)} total
            </p>
          </div>
        </div>
      </div>

      {/* Detail breakdown */}
      <div className="space-y-2">
        {duplicateCount > 0 && (
          <DetailRow
            icon={<Copy className="w-3.5 h-3.5 text-slate-400" />}
            label={`${duplicateCount} donation${duplicateCount !== 1 ? 's' : ''} already in system`}
            note="Will be skipped"
            color="slate"
          />
        )}
        {seecIssueCount > 0 && (
          <DetailRow
            icon={<AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
            label={`${seecIssueCount} donation${seecIssueCount !== 1 ? 's' : ''} missing employer or occupation`}
            note="Will be imported and flagged for review"
            color="amber"
          />
        )}
        {limitIssueCount > 0 && (
          <DetailRow
            icon={<AlertCircle className="w-3.5 h-3.5 text-red-500" />}
            label={`${limitIssueCount} donation${limitIssueCount !== 1 ? 's' : ''} at or over the $2,000 annual limit`}
            note="Will be imported and flagged — excess amounts may need to be refunded"
            color="red"
          />
        )}
        {errorCount > 0 && (
          <DetailRow
            icon={<XCircle className="w-3.5 h-3.5 text-red-500" />}
            label={`${errorCount} row${errorCount !== 1 ? 's' : ''} with invalid data`}
            note="Will be skipped"
            color="red"
          />
        )}
      </div>

      <p className="text-xs text-slate-400 pt-2">
        Imported donations will be marked as <strong>source: Anedot</strong> and can be edited individually after import.
      </p>
    </div>
  )
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function DoneStep({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        {count} donation{count !== 1 ? 's' : ''} imported
      </h3>
      <p className="text-sm text-slate-500 max-w-xs mb-6">
        They&apos;ve been added to your donations list. Any SEEC issues are flagged for review.
      </p>
      <button
        onClick={onClose}
        className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        View donations
      </button>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['upload', 'preview', 'confirm', 'done']
  const idx = steps.indexOf(current)
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div
          key={s}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i <= idx ? 'bg-blue-500' : 'bg-slate-200',
            i === idx ? 'w-5' : 'w-1.5'
          )}
        />
      ))}
    </div>
  )
}

function Pill({
  color,
  label,
  value,
}: {
  color: 'emerald' | 'amber' | 'red' | 'slate'
  label: string
  value: string
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1', colors[color])}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-70">·</span>
      {label}
    </span>
  )
}

function RowStatusBadge({ row }: { row: ParsedRow }) {
  if (row.isError) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="w-3 h-3" />
        {row.errorMessage ?? 'Error'}
      </span>
    )
  }
  if (row.isDuplicate) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400">
        <Copy className="w-3 h-3" />
        Already imported
      </span>
    )
  }
  if (row.limitIssues.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600" title={row.limitIssues.join(', ')}>
        <AlertCircle className="w-3 h-3" />
        Over limit
      </span>
    )
  }
  if (row.seecIssues.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600" title={row.seecIssues.join(', ')}>
        <AlertCircle className="w-3 h-3" />
        SEEC issues
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600">
      <CheckCircle2 className="w-3 h-3" />
      Ready
    </span>
  )
}

function DetailRow({
  icon,
  label,
  note,
  color,
}: {
  icon: React.ReactNode
  label: string
  note: string
  color: 'amber' | 'red' | 'slate'
}) {
  const bg = { amber: 'bg-amber-50 border-amber-200', red: 'bg-red-50 border-red-200', slate: 'bg-slate-50 border-slate-200' }
  return (
    <div className={cn('flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs', bg[color])}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-medium text-slate-700">{label}</p>
        <p className="text-slate-500 mt-0.5">{note}</p>
      </div>
    </div>
  )
}
