'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Expenditure, ExpenseCategory, PaymentMethod } from '@/lib/types'
import { createExpenditure } from '@/actions/expenses'
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (expenditure: Expenditure) => void
  committeeId: string
  committeeSlug: string
}

interface FormData {
  amount: string
  date: string
  payee: string
  purpose: string
  category: ExpenseCategory
  method: PaymentMethod
  checkNumber: string
  memo: string
}

const EMPTY: FormData = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  payee: '',
  purpose: '',
  category: 'OTHER',
  method: 'CHECK',
  checkNumber: '',
  memo: '',
}

export default function AddExpenseDialog({ open, onClose, onAdd, committeeId, committeeSlug }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
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
      const expenditure = await createExpenditure(
        committeeId,
        {
          amount: parseFloat(form.amount),
          date: form.date,
          payee: form.payee.trim(),
          purpose: form.purpose.trim(),
          category: form.category,
          method: form.method,
          checkNumber: form.checkNumber.trim() || undefined,
          memo: form.memo.trim() || undefined,
        },
        committeeSlug
      )
      onAdd(expenditure)
      setForm(EMPTY)
      setErrors({})
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Record an expense</h2>
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

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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

          {/* Payee */}
          <Field label="Payee" required error={errors.payee}>
            <input
              type="text"
              value={form.payee}
              onChange={(e) => set('payee', e.target.value)}
              placeholder="e.g. Guilford Printing Co."
              className={inputCls(!!errors.payee)}
            />
          </Field>

          {/* Category + Purpose */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value as ExpenseCategory)}
                className={inputCls(false)}
              >
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
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

          {/* Check number (conditional) */}
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

          {/* Memo */}
          <Field label="Internal note (optional)">
            <input
              type="text"
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              placeholder="Any additional details"
              className={inputCls(false)}
            />
          </Field>

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
              {saving ? 'Saving…' : 'Save expense'}
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
