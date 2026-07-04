'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CustomFilingPeriodRecord } from '@/actions/filings'
import { createCustomFilingPeriod } from '@/actions/filings'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (period: CustomFilingPeriodRecord) => void
  committeeId: string
  committeeSlug: string
}

export default function CustomPeriodDialog({ open, onClose, onSave, committeeId, committeeSlug }: Props) {
  const [label, setLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return setError('Enter a label for this filing period')
    if (!periodStart || !periodEnd) return setError('Enter a start and end date')
    if (periodEnd < periodStart) return setError('End date must be on or after the start date')

    setSaving(true)
    setError('')
    try {
      const saved = await createCustomFilingPeriod(
        committeeId,
        { label: label.trim(), periodStart, periodEnd, dueDate: dueDate.trim() || undefined },
        committeeSlug
      )
      onSave(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add filing period</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              For a filing outside the standard quarterly schedule — e.g. a pre-election report
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <Field label="Label" required>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Pre-election filing — Nov 2026 general"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start" required>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Period end" required>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Due date (optional)">
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="e.g. Oct 30, 2026"
              className={inputCls}
            />
          </Field>

          <p className="text-xs text-slate-400">
            Any standard quarterly period this overlaps will be split around it automatically, so nothing gets double-counted.
          </p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
