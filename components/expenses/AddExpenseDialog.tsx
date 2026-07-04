'use client'

import { useState } from 'react'
import { X, BookmarkPlus, Check } from 'lucide-react'
import type { Expenditure, ExpenseCategory, PaymentMethod, CommitteeEvent, Payee } from '@/lib/types'
import { createExpenditure, updateExpenditure } from '@/actions/expenses'
import { createPayee } from '@/actions/payees'
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (expenditure: Expenditure) => void
  committeeId: string
  committeeSlug: string
  expenditure?: Expenditure // pre-fills the form for edit mode
  events?: CommitteeEvent[]
  payees?: Payee[]
  onPayeeCreated?: (payee: Payee) => void
  /** Seeds the form for a new (non-edit) expense — e.g. reconciling a bank transaction. Ignored when `expenditure` is set. */
  initialValues?: Partial<{ amount: number; date: string; payee: string; method: PaymentMethod }>
}

interface FormData {
  amount: string
  date: string
  payee: string
  payeeAddress1: string
  payeeCity: string
  payeeState: string
  payeeZip: string
  purpose: string
  category: ExpenseCategory
  method: PaymentMethod
  checkNumber: string
  memo: string
  eventId: string
}

const EMPTY: FormData = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  payee: '',
  payeeAddress1: '',
  payeeCity: '',
  payeeState: '',
  payeeZip: '',
  purpose: '',
  category: 'MISC',
  method: 'CHECK',
  checkNumber: '',
  memo: '',
  eventId: '',
}

export default function AddExpenseDialog({ open, onClose, onAdd, committeeId, committeeSlug, expenditure, events = [], payees = [], onPayeeCreated, initialValues }: Props) {
  const isEdit = !!expenditure
  const [form, setForm] = useState<FormData>(
    expenditure
      ? {
          amount: expenditure.amount.toFixed(2),
          date: expenditure.date,
          payee: expenditure.payee,
          payeeAddress1: expenditure.payeeAddress1 ?? '',
          payeeCity: expenditure.payeeCity ?? '',
          payeeState: expenditure.payeeState ?? '',
          payeeZip: expenditure.payeeZip ?? '',
          purpose: expenditure.purpose,
          category: expenditure.category,
          method: expenditure.method,
          checkNumber: expenditure.checkNumber ?? '',
          memo: expenditure.memo ?? '',
          eventId: expenditure.eventId ?? '',
        }
      : {
          ...EMPTY,
          amount: initialValues?.amount !== undefined ? initialValues.amount.toFixed(2) : EMPTY.amount,
          date: initialValues?.date ?? EMPTY.date,
          payee: initialValues?.payee ?? EMPTY.payee,
          method: initialValues?.method ?? EMPTY.method,
        }
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [savingPayee, setSavingPayee] = useState(false)
  const [payeeSaved, setPayeeSaved] = useState(false)
  const [payeeSaveError, setPayeeSaveError] = useState('')

  if (!open) return null

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    if (key === 'payee' || key === 'category' || key === 'purpose') {
      setPayeeSaved(false)
      setPayeeSaveError('')
    }
  }

  async function handleSaveAsPayee() {
    if (!form.payee.trim()) {
      setPayeeSaveError('Enter a payee name first')
      return
    }
    setSavingPayee(true)
    setPayeeSaveError('')
    try {
      const payee = await createPayee(
        committeeId,
        {
          name: form.payee.trim(),
          address1: form.payeeAddress1.trim() || undefined,
          city: form.payeeCity.trim() || undefined,
          state: form.payeeState.trim() || undefined,
          zip: form.payeeZip.trim() || undefined,
          defaultCategory: form.category,
          defaultPurpose: form.purpose.trim() || undefined,
        },
        committeeSlug
      )
      onPayeeCreated?.(payee)
      setPayeeSaved(true)
    } catch (err) {
      setPayeeSaveError(err instanceof Error ? err.message : 'Failed to save payee')
    } finally {
      setSavingPayee(false)
    }
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) e.amount = 'Enter a valid amount'
    if (!form.date) e.date = 'Date is required'
    if (!form.payee.trim()) e.payee = 'Payee is required'
    if (!form.purpose.trim()) e.purpose = 'Purpose is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        amount: parseFloat(form.amount),
        date: form.date,
        payee: form.payee.trim(),
        payeeAddress1: form.payeeAddress1.trim() || undefined,
        payeeCity: form.payeeCity.trim() || undefined,
        payeeState: form.payeeState.trim() || undefined,
        payeeZip: form.payeeZip.trim() || undefined,
        purpose: form.purpose.trim(),
        category: form.category,
        method: form.method,
        checkNumber: form.checkNumber.trim() || undefined,
        memo: form.memo.trim() || undefined,
        eventId: form.eventId || undefined,
      }
      const saved = isEdit && expenditure
        ? await updateExpenditure(expenditure.id, payload, committeeSlug)
        : await createExpenditure(committeeId, payload, committeeSlug)
      onAdd(saved)
      setForm(EMPTY)
      setErrors({})
      setPayeeSaved(false)
      setPayeeSaveError('')
    } catch {
      setErrors({ amount: 'Something went wrong. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setForm(EMPTY)
    setErrors({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? 'Edit expense' : 'Record an expense'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All expenditures must be reported on SEEC Form 20
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" required error={errors.amount}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="0.00"
                  className={inputCls(!!errors.amount) + ' pl-7'}
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Date" required error={errors.date}>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className={inputCls(!!errors.date)}
              />
            </Field>
          </div>

          {/* Saved payee */}
          {payees.length > 0 && (
            <Field label="Use a saved payee (optional)">
              <select
                value=""
                onChange={(e) => {
                  const p = payees.find((x) => x.id === e.target.value)
                  if (!p) return
                  setForm((prev) => ({
                    ...prev,
                    payee: p.name,
                    payeeAddress1: p.address1 ?? prev.payeeAddress1,
                    payeeCity: p.city ?? prev.payeeCity,
                    payeeState: p.state ?? prev.payeeState,
                    payeeZip: p.zip ?? prev.payeeZip,
                    category: p.defaultCategory,
                    purpose: p.defaultPurpose ?? prev.purpose,
                  }))
                  setErrors((prev) => ({ ...prev, payee: undefined, purpose: undefined }))
                }}
                className={inputCls(false)}
              >
                <option value="">— Select a saved payee —</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Payee + Category */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payee" required error={errors.payee}>
              <input
                type="text"
                value={form.payee}
                onChange={(e) => set('payee', e.target.value)}
                placeholder="e.g. Guilford Printing Co."
                className={inputCls(!!errors.payee)}
              />
            </Field>

            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value as ExpenseCategory)}
                className={inputCls(false)}
              >
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {c}: {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Payee address + Payment method */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payee street address (optional)">
              <input
                type="text"
                value={form.payeeAddress1}
                onChange={(e) => set('payeeAddress1', e.target.value)}
                placeholder="12 Elm Street"
                className={inputCls(false)}
              />
            </Field>

            <Field label="Payment method">
              <select
                value={form.method}
                onChange={(e) => set('method', e.target.value as PaymentMethod)}
                className={inputCls(false)}
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="City">
              <input
                type="text"
                value={form.payeeCity}
                onChange={(e) => set('payeeCity', e.target.value)}
                placeholder="Guilford"
                className={inputCls(false)}
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={form.payeeState}
                onChange={(e) => set('payeeState', e.target.value)}
                placeholder="CT"
                maxLength={2}
                className={inputCls(false)}
              />
            </Field>
            <Field label="ZIP">
              <input
                type="text"
                value={form.payeeZip}
                onChange={(e) => set('payeeZip', e.target.value)}
                placeholder="06437"
                className={inputCls(false)}
              />
            </Field>
          </div>

          {/* Purpose */}
          <Field label="Purpose / description" required error={errors.purpose}>
            <input
              type="text"
              value={form.purpose}
              onChange={(e) => set('purpose', e.target.value)}
              placeholder="e.g. Fall mailer — 2,500 pieces"
              className={inputCls(!!errors.purpose)}
            />
          </Field>

          {/* Save current payee/category/purpose as a reusable payee */}
          <div className="flex items-center gap-2 -mt-1">
            <button
              type="button"
              onClick={handleSaveAsPayee}
              disabled={savingPayee || payeeSaved}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-60 disabled:cursor-default transition-colors"
            >
              {payeeSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved as payee
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  {savingPayee ? 'Saving…' : 'Save as payee'}
                </>
              )}
            </button>
            {payeeSaveError && <span className="text-xs text-red-600">{payeeSaveError}</span>}
          </div>

          {/* Check number + Internal note */}
          <div className="grid grid-cols-2 gap-4">
            {form.method === 'CHECK' && (
              <Field label="Check number">
                <input
                  type="text"
                  value={form.checkNumber}
                  onChange={(e) => set('checkNumber', e.target.value)}
                  placeholder="e.g. 5001"
                  className={inputCls(false)}
                />
              </Field>
            )}

            <Field label="Internal note (optional)">
              <input
                type="text"
                value={form.memo}
                onChange={(e) => set('memo', e.target.value)}
                placeholder="Any additional details"
                className={inputCls(false)}
              />
            </Field>
          </div>

          {events.length > 0 && (
            <Field label="Linked event (optional)">
              <select
                value={form.eventId}
                onChange={(e) => set('eventId', e.target.value)}
                className={inputCls(false)}
              >
                <option value="">— None —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.letter} · {ev.description} ({formatDate(ev.date)})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls = (hasError: boolean) =>
  [
    'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:border-transparent bg-white',
    hasError
      ? 'border-red-300 focus:ring-red-400'
      : 'border-slate-200 focus:ring-blue-500',
  ].join(' ')

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
