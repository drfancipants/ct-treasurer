'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { SeecFilingRecord } from '@/actions/filings'
import { updateFilingBalance } from '@/actions/filings'
import { formatCurrency } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (filing: SeecFilingRecord) => void
  committeeId: string
  committeeSlug: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  /** Existing explicit values for this period, if any */
  filing?: SeecFilingRecord
  /** Previous period's ending balance — used as the default beginning balance when this period has none of its own yet */
  suggestedBeginningBalance?: number
}

export default function FilingBalanceDialog({
  open, onClose, onSave, committeeId, committeeSlug, periodLabel, periodStart, periodEnd, filing, suggestedBeginningBalance,
}: Props) {
  const [beginningBalance, setBeginningBalance] = useState(
    filing?.beginningBalance !== undefined
      ? filing.beginningBalance.toFixed(2)
      : suggestedBeginningBalance !== undefined
        ? suggestedBeginningBalance.toFixed(2)
        : ''
  )
  const [endingBalance, setEndingBalance] = useState(filing?.endingBalance?.toFixed(2) ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const beginning = beginningBalance.trim() === '' ? undefined : parseFloat(beginningBalance)
    const ending = endingBalance.trim() === '' ? undefined : parseFloat(endingBalance)
    if (beginning !== undefined && isNaN(beginning)) return setError('Enter a valid beginning balance')
    if (ending !== undefined && isNaN(ending)) return setError('Enter a valid ending balance')

    setSaving(true)
    setError('')
    try {
      const saved = await updateFilingBalance(
        committeeId,
        periodStart,
        periodEnd,
        { beginningBalance: beginning, endingBalance: ending },
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
            <h2 className="text-base font-semibold text-slate-900">Balance on hand</h2>
            <p className="text-xs text-slate-500 mt-0.5">{periodLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <Field label="Beginning balance">
            <input
              type="text"
              inputMode="decimal"
              value={beginningBalance}
              onChange={(e) => setBeginningBalance(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
            {suggestedBeginningBalance !== undefined && filing?.beginningBalance === undefined && (
              <p className="text-xs text-slate-400 mt-1">
                Suggested from the previous period&apos;s ending balance ({formatCurrency(suggestedBeginningBalance)}) — edit if needed
              </p>
            )}
          </Field>

          <Field label="Ending balance">
            <input
              type="text"
              inputMode="decimal"
              value={endingBalance}
              onChange={(e) => setEndingBalance(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">
              Carries forward as the beginning balance suggestion for the next period
            </p>
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}
