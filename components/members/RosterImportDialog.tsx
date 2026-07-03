'use client'

import { useState, useRef } from 'react'
import { X, Upload, CheckCircle2, XCircle, UserPlus, UserCog } from 'lucide-react'
import type { RosterMember } from '@/lib/types'
import { parseRosterCsv, type RosterParseResult, type ParsedRosterRow } from '@/lib/roster-csv'
import { importRosterMembers } from '@/actions/roster'
import { cn } from '@/lib/utils'

type Step = 'upload' | 'preview' | 'done'

interface Props {
  open: boolean
  onClose: () => void
  /** Receives the full refreshed roster after a successful import */
  onImported: (members: RosterMember[]) => void
  existingMembers: RosterMember[]
  committeeId: string
  committeeSlug: string
}

export default function RosterImportDialog({
  open, onClose, onImported, existingMembers, committeeId, committeeSlug,
}: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<RosterParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [doneCounts, setDoneCounts] = useState({ created: 0, updated: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Please upload a .csv file')
      return
    }
    setImportError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setResult(parseRosterCsv(e.target?.result as string, existingMembers))
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!result) return
    setImporting(true)
    setImportError('')
    try {
      const { members, created, updated } = await importRosterMembers(committeeId, result.rows, committeeSlug)
      setDoneCounts({ created, updated })
      onImported(members)
      setStep('done')
    } catch {
      setImportError('Import failed — nothing was saved. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const importableCount = (result?.createCount ?? 0) + (result?.updateCount ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Import roster from CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'upload' && 'Seed or update the committee roster from a spreadsheet'}
              {step === 'preview' && `${result?.rows.length ?? 0} rows found in ${fileName}`}
              {step === 'done' && 'Import complete'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="p-6 space-y-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 p-12 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {dragging ? 'Drop your CSV here' : 'Drag & drop a roster CSV'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">or click to browse · .csv files only</p>
                </div>
              </div>

              {importError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{importError}</div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Recognized columns</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Name</strong> (or First/Last Name), <strong>Email</strong>, <strong>Phone</strong>,{' '}
                  <strong>Address</strong>, <strong>City/Town</strong>, <strong>State</strong>, <strong>ZIP</strong>,{' '}
                  <strong>Active</strong> (or Status), <strong>Dues</strong> (yes/no, paid/unpaid, or a dollar amount),{' '}
                  and <strong>Notes</strong>. Header spelling is flexible; extra columns are ignored.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Rows matching an existing member (by email, else by name) update that member —
                  blank cells never erase existing data. Everyone else is added as new.
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && result && (
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Pill color="emerald" label="new members" value={String(result.createCount)} />
                <Pill color="blue" label="updates to existing" value={String(result.updateCount)} />
                {result.errorCount > 0 && <Pill color="red" label="rows skipped" value={String(result.errorCount)} />}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Row</th>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Member</th>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap hidden md:table-cell">Town</th>
                        <th className="px-3 py-2.5 text-center font-medium text-slate-500 whitespace-nowrap">Dues</th>
                        <th className="px-3 py-2.5 text-center font-medium text-slate-500 whitespace-nowrap">Active</th>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.rows.slice(0, 25).map((row) => (
                        <tr key={row.rowIndex} className={cn(row.isError ? 'opacity-50' : 'hover:bg-slate-50 transition-colors')}>
                          <td className="px-3 py-2.5 text-slate-400 tabular">{row.rowIndex}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-slate-800">{row.firstName} {row.lastName}</span>
                            {row.email && <span className="text-slate-400 ml-1">· {row.email}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 hidden md:table-cell">{row.city ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{flagLabel(row.duesPaid, 'Paid', 'Unpaid')}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{flagLabel(row.isActive, 'Yes', 'No')}</td>
                          <td className="px-3 py-2.5"><ActionBadge row={row} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.rows.length > 25 && (
                  <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
                    Showing 25 of {result.rows.length} rows
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400">
                “—” means the column was blank; existing values are kept for updates, and new members
                default to active with dues unpaid.
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="p-6 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                {doneCounts.created} added · {doneCounts.updated} updated
              </h3>
              <p className="text-sm text-slate-500 max-w-xs mb-6">
                The roster has been refreshed. Contribution totals are matched by email automatically.
              </p>
              <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                View roster
              </button>
            </div>
          )}
        </div>

        {step === 'preview' && result && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
            <button onClick={() => { setStep('upload'); setResult(null) }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
              Choose a different file
            </button>
            <div className="flex items-center gap-3">
              {importError && (
                <span className="flex items-center gap-1.5 text-xs text-red-600">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  {importError}
                </span>
              )}
              <button
                onClick={handleImport}
                disabled={importing || importableCount === 0}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {importing ? 'Importing…' : `Import ${importableCount} ${importableCount === 1 ? 'member' : 'members'}`}
              </button>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
      </div>
    </div>
  )
}

function flagLabel(v: boolean | undefined, yes: string, no: string): string {
  if (v === undefined) return '—'
  return v ? yes : no
}

function ActionBadge({ row }: { row: ParsedRosterRow }) {
  if (row.isError) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="w-3 h-3" /> {row.errorMessage ?? 'Error'}
      </span>
    )
  }
  if (row.action === 'update') {
    return (
      <span className="inline-flex items-center gap-1 text-blue-600">
        <UserCog className="w-3 h-3" /> Update
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600">
      <UserPlus className="w-3 h-3" /> New
    </span>
  )
}

function Pill({ color, label, value }: { color: 'emerald' | 'blue' | 'red'; label: string; value: string }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1', colors[color])}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-70">·</span>
      {label}
    </span>
  )
}
