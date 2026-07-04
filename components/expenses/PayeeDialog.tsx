'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Payee, ExpenseCategory } from '@/lib/types'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/types'
import { createPayee, updatePayee, type PayeeInput } from '@/actions/payees'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (row: Payee) => void
  committeeId: string
  committeeSlug: string
  payee?: Payee
}

type FormState = {
  name: string
  address1: string
  city: string
  state: string
  zip: string
  defaultCategory: ExpenseCategory
  defaultPurpose: string
}

function initial(p?: Payee): FormState {
  return {
    name: p?.name ?? '',
    address1: p?.address1 ?? '',
    city: p?.city ?? '',
    state: p?.state ?? 'CT',
    zip: p?.zip ?? '',
    defaultCategory: p?.defaultCategory ?? 'MISC',
    defaultPurpose: p?.defaultPurpose ?? '',
  }
}

export default function PayeeDialog({
  open, onClose, onSave, committeeId, committeeSlug, payee,
}: Props) {
  const isEdit = !!payee
  const [form, setForm] = useState<FormState>(() => initial(payee))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required')

    setSaving(true)
    setError('')
    const payload: PayeeInput = {
      name: form.name.trim(),
      address1: form.address1.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || 'CT',
      zip: form.zip.trim() || undefined,
      defaultCategory: form.defaultCategory,
      defaultPurpose: form.defaultPurpose.trim() || undefined,
    }
    try {
      const saved = isEdit
        ? await updatePayee(payee!.id, payload, committeeSlug)
        : await createPayee(committeeId, payload, committeeSlug)
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
              {isEdit ? 'Edit payee' : 'Add payee'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved defaults to speed up recording future expenses
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <Field label="Name" required>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Guilford Printing Co." className={inputCls} autoFocus />
          </Field>

          <Field label="Street address">
            <input value={form.address1} onChange={(e) => set('address1', e.target.value)} placeholder="12 Elm Street" className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Guilford" className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} className={inputCls} /></Field>
            <Field label="ZIP"><input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="06437" className={inputCls} /></Field>
          </div>

          <Field label="Default category">
            <select
              value={form.defaultCategory}
              onChange={(e) => set('defaultCategory', e.target.value as ExpenseCategory)}
              className={inputCls}
            >
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {c}: {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default purpose (optional)">
            <input
              value={form.defaultPurpose}
              onChange={(e) => set('defaultPurpose', e.target.value)}
              placeholder="e.g. Palm cards printing"
              className={inputCls}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add payee'}
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
