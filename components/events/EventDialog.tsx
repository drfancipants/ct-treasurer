'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CommitteeEvent } from '@/lib/types'
import { createEvent, updateEvent, type EventInput } from '@/actions/events'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (event: CommitteeEvent) => void
  committeeId: string
  committeeSlug: string
  event?: CommitteeEvent
  usedLetters: string[]
}

type FormState = {
  letter: string
  date: string
  description: string
  isFundraiser: boolean
  street: string
  city: string
  state: string
  zip: string
  isPersonalResidence: boolean
  hadDonatedGoods: boolean
  wasTagSale: boolean
  hadProgramBook: boolean
  soldFoodAtFair: boolean
  foodReceipts: string
  tagSaleReceipts: string
  notes: string
}

function initial(event: CommitteeEvent | undefined, defaultLetter: string): FormState {
  return {
    letter: event?.letter ?? defaultLetter,
    date: event?.date ?? new Date().toISOString().split('T')[0],
    description: event?.description ?? '',
    isFundraiser: event?.isFundraiser ?? true,
    street: event?.street ?? '',
    city: event?.city ?? '',
    state: event?.state ?? 'CT',
    zip: event?.zip ?? '',
    isPersonalResidence: event?.isPersonalResidence ?? false,
    hadDonatedGoods: event?.hadDonatedGoods ?? false,
    wasTagSale: event?.wasTagSale ?? false,
    hadProgramBook: event?.hadProgramBook ?? false,
    soldFoodAtFair: event?.soldFoodAtFair ?? false,
    foodReceipts: event ? String(event.foodReceipts || '') : '',
    tagSaleReceipts: event ? String(event.tagSaleReceipts || '') : '',
    notes: event?.notes ?? '',
  }
}

export default function EventDialog({ open, onClose, onSave, committeeId, committeeSlug, event, usedLetters }: Props) {
  // Letters free to assign: A–Z not used by another event, plus this event's own
  const usedByOthers = new Set(
    usedLetters.filter((l) => l.toUpperCase() !== event?.letter?.toUpperCase()).map((l) => l.toUpperCase())
  )
  const available = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter(
    (l) => !usedByOthers.has(l)
  )
  const defaultLetter = event?.letter ?? available[0] ?? 'A'
  const isEdit = !!event
  const [form, setForm] = useState<FormState>(() => initial(event, defaultLetter))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return setError('Description is required')
    if (!form.date) return setError('Date is required')

    setSaving(true)
    setError('')
    const payload: EventInput = {
      letter: form.letter,
      date: form.date,
      description: form.description.trim(),
      isFundraiser: form.isFundraiser,
      street: form.street.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || 'CT',
      zip: form.zip.trim() || undefined,
      isPersonalResidence: form.isPersonalResidence,
      hadDonatedGoods: form.hadDonatedGoods,
      wasTagSale: form.wasTagSale,
      hadProgramBook: form.hadProgramBook,
      soldFoodAtFair: form.soldFoodAtFair,
      foodReceipts: parseFloat(form.foodReceipts) || 0,
      tagSaleReceipts: parseFloat(form.tagSaleReceipts) || 0,
      notes: form.notes.trim() || undefined,
    }
    try {
      const saved = isEdit
        ? await updateEvent(event!.id, payload, committeeSlug)
        : await createEvent(committeeId, payload, committeeSlug)
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
            <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit event' : 'Add event'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fundraising / event details for SEEC Section L1</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label="Event #">
              <select value={form.letter} onChange={(e) => set('letter', e.target.value)} className={inputCls}>
                {available.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Date" required>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </Field>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={form.isFundraiser} onChange={(e) => set('isFundraiser', e.target.checked)} className={checkCls} />
              <span className="text-sm text-slate-700">Fundraiser</span>
            </label>
          </div>

          <Field label="Description" required>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Annual spring dinner" className={inputCls} maxLength={100} />
          </Field>

          <Field label="Street address">
            <input value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="14 Whitfield Street" className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Guilford" className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set('state', e.target.value)} className={inputCls} maxLength={2} /></Field>
            <Field label="ZIP"><input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="06437" className={inputCls} /></Field>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="text-xs font-medium text-slate-700">SEEC event questions</p>
            <Check label="Hosted at a personal residence" checked={form.isPersonalResidence} onChange={(v) => set('isPersonalResidence', v)} />
            <Check label="Included donated goods/services (business ≤ $200 / individual ≤ $100)" checked={form.hadDonatedGoods} onChange={(v) => set('hadDonatedGoods', v)} />
            <Check label="Tag sale, auction, or sale of donated items" checked={form.wasTagSale} onChange={(v) => set('wasTagSale', v)} />
            <Check label="Sold advertising space in a program book" checked={form.hadProgramBook} onChange={(v) => set('hadProgramBook', v)} />
            <Check label="Sold food/beverage at a fair or mass gathering" checked={form.soldFoodAtFair} onChange={(v) => set('soldFoodAtFair', v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Food receipts ($)">
              <input type="text" inputMode="decimal" value={form.foodReceipts} onChange={(e) => set('foodReceipts', e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Tag-sale receipts ($)">
              <input type="text" inputMode="decimal" value={form.tagSaleReceipts} onChange={(e) => set('tagSaleReceipts', e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal note" className={inputCls} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save event'}
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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`${checkCls} mt-0.5`} />
      <span className="text-xs text-slate-600">{label}</span>
    </label>
  )
}
