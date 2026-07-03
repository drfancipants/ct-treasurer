'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Reimbursement, ExpenseCategory, PaymentMethod, CommitteeEvent, Expenditure } from '@/lib/types'
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types'
import {
  createReimbursement,
  updateReimbursement,
  type ReimbursementInput,
} from '@/actions/reimbursements'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (row: Reimbursement) => void
  committeeId: string
  committeeSlug: string
  reimbursement?: Reimbursement
  expenditures: Expenditure[]
  events: CommitteeEvent[]
}

type FormState = {
  workerLastName: string
  workerFirstName: string
  workerMiddleInitial: string
  description: string
  date: string
  amount: string
  method: PaymentMethod
  checkNumber: string
  vendorName: string
  street: string
  city: string
  state: string
  zip: string
  category: ExpenseCategory
  expenditureId: string
  eventId: string
  memo: string
}

function initial(r?: Reimbursement): FormState {
  return {
    workerLastName: r?.workerLastName ?? '',
    workerFirstName: r?.workerFirstName ?? '',
    workerMiddleInitial: r?.workerMiddleInitial ?? '',
    description: r?.description ?? '',
    date: r?.date ?? new Date().toISOString().split('T')[0],
    amount: r ? r.amount.toFixed(2) : '',
    method: r?.method ?? 'CHECK',
    checkNumber: r?.checkNumber ?? '',
    vendorName: r?.vendorName ?? '',
    street: r?.street ?? '',
    city: r?.city ?? '',
    state: r?.state ?? 'CT',
    zip: r?.zip ?? '',
    category: r?.category ?? 'MISC',
    expenditureId: r?.expenditureId ?? '',
    eventId: r?.eventId ?? '',
    memo: r?.memo ?? '',
  }
}

export default function ReimbursementDialog({
  open, onClose, onSave, committeeId, committeeSlug, reimbursement, expenditures, events,
}: Props) {
  const isEdit = !!reimbursement
  const [form, setForm] = useState<FormState>(() => initial(reimbursement))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.workerLastName.trim()) return setError('Worker last name is required')
    if (!form.workerFirstName.trim()) return setError('Worker first name is required')
    if (!form.description.trim()) return setError('Description is required')
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid amount')
    if (!form.date) return setError('Date is required')

    setSaving(true)
    setError('')
    const payload: ReimbursementInput = {
      workerLastName: form.workerLastName.trim(),
      workerFirstName: form.workerFirstName.trim(),
      workerMiddleInitial: form.workerMiddleInitial.trim() || undefined,
      description: form.description.trim(),
      date: form.date,
      amount,
      method: form.method,
      checkNumber: form.checkNumber.trim() || undefined,
      vendorName: form.vendorName.trim() || undefined,
      street: form.street.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || 'CT',
      zip: form.zip.trim() || undefined,
      category: form.category,
      expenditureId: form.expenditureId || undefined,
      eventId: form.eventId || undefined,
      memo: form.memo.trim() || undefined,
    }
    try {
      const saved = isEdit
        ? await updateReimbursement(reimbursement!.id, payload, committeeSlug)
        : await createReimbursement(committeeId, payload, committeeSlug)
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
              {isEdit ? 'Edit worker reimbursement' : 'Add worker reimbursement'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Out-of-pocket payment by a committee worker (SEEC Section T)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2"><Field label="Worker last name" required><input value={form.workerLastName} onChange={(e) => set('workerLastName', e.target.value)} placeholder="Smith" className={inputCls} /></Field></div>
            <div className="col-span-2"><Field label="First name" required><input value={form.workerFirstName} onChange={(e) => set('workerFirstName', e.target.value)} placeholder="Jane" className={inputCls} /></Field></div>
            <Field label="M.I."><input value={form.workerMiddleInitial} onChange={(e) => set('workerMiddleInitial', e.target.value)} maxLength={1} className={inputCls} /></Field>
          </div>

          <Field label="What was purchased" required>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Stamps for fall mailer" className={inputCls} maxLength={100} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date paid" required><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} /></Field>
            <Field label="Amount ($)" required><input type="text" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" className={inputCls} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment method">
              <select value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)} className={inputCls}>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </Field>
            <Field label="Purpose category">
              <select value={form.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)} className={inputCls}>
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>{c}: {EXPENSE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Field>
          </div>

          {form.method === 'CHECK' && (
            <Field label="Check number"><input value={form.checkNumber} onChange={(e) => set('checkNumber', e.target.value)} placeholder="e.g. 5001" className={inputCls} /></Field>
          )}

          <Field label="Vendor name"><input value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} placeholder="Guilford Post Office" className={inputCls} /></Field>
          <Field label="Vendor street address"><input value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="14 Whitfield Street" className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Guilford" className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} className={inputCls} /></Field>
            <Field label="ZIP"><input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="06437" className={inputCls} /></Field>
          </div>

          {expenditures.length > 0 && (
            <Field label="Reimbursement payment (Section P expense, optional)">
              <select value={form.expenditureId} onChange={(e) => set('expenditureId', e.target.value)} className={inputCls}>
                <option value="">— Not yet repaid —</option>
                {expenditures.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.payee} · {formatCurrency(ex.amount)} ({formatDate(ex.date)})</option>
                ))}
              </select>
            </Field>
          )}

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

          <Field label="Internal note (optional)"><input value={form.memo} onChange={(e) => set('memo', e.target.value)} placeholder="Any additional details" className={inputCls} /></Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save reimbursement'}
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
