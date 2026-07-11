'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CommitteeContribution, CommitteeEvent, PaymentMethod } from '@/lib/types'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import {
  createCommitteeContribution,
  updateCommitteeContribution,
  type CommitteeContributionInput,
} from '@/actions/committee-contributions'
import { formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (row: CommitteeContribution) => void
  committeeId: string
  committeeSlug: string
  contribution?: CommitteeContribution
  events: CommitteeEvent[]
  /** Seeds the form for a new (non-edit) contribution — e.g. reconciling a bank transaction. Ignored when `contribution` is set. */
  initialValues?: Partial<{ amount: number; date: string; fromName: string }>
  /** Pre-fills a NEW contribution from an existing one (date reset to today), to save as a separate record. Ignored when `contribution` is set. */
  duplicateFrom?: CommitteeContribution
}

type FormState = {
  fromName: string
  treasurerName: string
  street: string
  city: string
  state: string
  zip: string
  date: string
  amount: string
  method: PaymentMethod | ''
  checkNumber: string
  eventId: string
  memo: string
}

function initial(c?: CommitteeContribution, initialValues?: Partial<{ amount: number; date: string; fromName: string }>): FormState {
  return {
    fromName: c?.fromName ?? initialValues?.fromName ?? '',
    treasurerName: c?.treasurerName ?? '',
    street: c?.street ?? '',
    city: c?.city ?? '',
    state: c?.state ?? 'CT',
    zip: c?.zip ?? '',
    date: c?.date ?? initialValues?.date ?? new Date().toISOString().split('T')[0],
    amount: c ? c.amount.toFixed(2) : initialValues?.amount !== undefined ? initialValues.amount.toFixed(2) : '',
    method: c?.method ?? '',
    checkNumber: c?.checkNumber ?? '',
    eventId: c?.eventId ?? '',
    memo: c?.memo ?? '',
  }
}

export default function CommitteeContributionDialog({
  open, onClose, onSave, committeeId, committeeSlug, contribution, events, initialValues, duplicateFrom,
}: Props) {
  const isEdit = !!contribution
  const isDuplicate = !contribution && !!duplicateFrom
  const [form, setForm] = useState<FormState>(() =>
    contribution
      ? initial(contribution)
      : duplicateFrom
        // Copy every field but reset the date — a duplicate is a fresh receipt.
        ? { ...initial(duplicateFrom), date: new Date().toISOString().split('T')[0] }
        : initial(undefined, initialValues)
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.fromName.trim()) return setError('Committee name is required')
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid amount')
    if (!form.date) return setError('Date is required')

    setSaving(true)
    setError('')
    const payload: CommitteeContributionInput = {
      fromName: form.fromName.trim(),
      treasurerName: form.treasurerName.trim() || undefined,
      street: form.street.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || 'CT',
      zip: form.zip.trim() || undefined,
      date: form.date,
      amount,
      method: form.method || undefined,
      checkNumber: form.checkNumber.trim() || undefined,
      eventId: form.eventId || undefined,
      memo: form.memo.trim() || undefined,
    }
    try {
      const saved = isEdit
        ? await updateCommitteeContribution(contribution!.id, payload, committeeSlug)
        : await createCommitteeContribution(committeeId, payload, committeeSlug)
      onSave(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? 'Edit committee contribution' : isDuplicate ? 'Duplicate committee contribution' : 'Add committee contribution'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Received from another committee (SEEC Section C1)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <Field label="Contributing committee" required>
            <input value={form.fromName} onChange={(e) => set('fromName', e.target.value)} placeholder="Madison Democratic Town Committee" className={inputCls} />
          </Field>
          <Field label="Treasurer name">
            <input value={form.treasurerName} onChange={(e) => set('treasurerName', e.target.value)} placeholder="Jane Smith" className={inputCls} maxLength={25} />
          </Field>

          <Field label="Committee street address">
            <input value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="14 Whitfield Street" className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Madison" className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set('state', e.target.value)} className={inputCls} maxLength={2} /></Field>
            <Field label="ZIP"><input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="06443" className={inputCls} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date received" required>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Amount ($)" required>
              <input type="text" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Donation method">
              <select value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod | '')} className={inputCls}>
                <option value="">— Unspecified —</option>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </Field>
            {form.method === 'CHECK' && (
              <Field label="Check number">
                <input value={form.checkNumber} onChange={(e) => set('checkNumber', e.target.value)} placeholder="e.g. 1042" className={inputCls} />
              </Field>
            )}
          </div>

          {events.length > 0 && (
            <Field label="Linked event (optional)">
              <select value={form.eventId} onChange={(e) => set('eventId', e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.letter} · {ev.description} ({formatDate(ev.date)})</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Internal note (optional)">
            <input value={form.memo} onChange={(e) => set('memo', e.target.value)} placeholder="Any additional details" className={inputCls} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save contribution'}
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
