'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { RosterMember } from '@/lib/types'
import {
  createRosterMember,
  updateRosterMember,
  type RosterMemberInput,
} from '@/actions/roster'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (row: RosterMember) => void
  committeeId: string
  committeeSlug: string
  member?: RosterMember
}

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  isActive: boolean
  duesPaid: boolean
  notes: string
}

function initial(m?: RosterMember): FormState {
  return {
    firstName: m?.firstName ?? '',
    lastName: m?.lastName ?? '',
    email: m?.email ?? '',
    phone: m?.phone ?? '',
    address1: m?.address1 ?? '',
    address2: m?.address2 ?? '',
    city: m?.city ?? '',
    state: m?.state ?? 'CT',
    zip: m?.zip ?? '',
    isActive: m?.isActive ?? true,
    duesPaid: m?.duesPaid ?? false,
    notes: m?.notes ?? '',
  }
}

export default function RosterMemberDialog({
  open, onClose, onSave, committeeId, committeeSlug, member,
}: Props) {
  const isEdit = !!member
  const [form, setForm] = useState<FormState>(() => initial(member))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim()) return setError('First name is required')
    if (!form.lastName.trim()) return setError('Last name is required')
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Enter a valid email address')

    setSaving(true)
    setError('')
    const payload: RosterMemberInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address1: form.address1.trim() || undefined,
      address2: form.address2.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || 'CT',
      zip: form.zip.trim() || undefined,
      isActive: form.isActive,
      duesPaid: form.duesPaid,
      notes: form.notes.trim() || undefined,
    }
    try {
      const saved = isEdit
        ? await updateRosterMember(member!.id, payload, committeeSlug)
        : await createRosterMember(committeeId, payload, committeeSlug)
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
              {isEdit ? 'Edit committee member' : 'Add committee member'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Roster entry — does not grant app access</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required><input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" className={inputCls} /></Field>
            <Field label="Last name" required><input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Smith" className={inputCls} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" className={inputCls} />
            </Field>
            <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(203) 555-0142" className={inputCls} /></Field>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">
            Contribution totals are matched to donation records by email.
          </p>

          <Field label="Home address"><input value={form.address1} onChange={(e) => set('address1', e.target.value)} placeholder="12 Elm Street" className={inputCls} /></Field>
          <Field label="Address line 2"><input value={form.address2} onChange={(e) => set('address2', e.target.value)} placeholder="Apt 2" className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Guilford" className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} className={inputCls} /></Field>
            <Field label="ZIP"><input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="06437" className={inputCls} /></Field>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className={`${checkCls} mt-0.5`} />
              <span className="text-xs text-slate-600">Active member</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.duesPaid} onChange={(e) => set('duesPaid', e.target.checked)} className={`${checkCls} mt-0.5`} />
              <span className="text-xs text-slate-600">Dues paid</span>
            </label>
          </div>

          <Field label="Notes (optional)"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any additional details" className={inputCls} /></Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
const checkCls = 'w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500'

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
