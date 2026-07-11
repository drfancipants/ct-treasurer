'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { InKindContribution, InKindEntityType, CommitteeEvent } from '@/lib/types'
import { IN_KIND_ENTITY_LABELS } from '@/lib/types'
import {
  createInKindContribution,
  updateInKindContribution,
  type InKindContributionInput,
} from '@/actions/in-kind-contributions'
import { formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (row: InKindContribution) => void
  committeeId: string
  committeeSlug: string
  contribution?: InKindContribution
  events: CommitteeEvent[]
  /** Pre-fills a NEW contribution from an existing one (date reset to today), to save as a separate record. Ignored when `contribution` is set. */
  duplicateFrom?: InKindContribution
}

type FormState = {
  entityType: InKindEntityType
  lastName: string
  firstName: string
  middleInitial: string
  entityName: string
  street: string
  city: string
  state: string
  zip: string
  date: string
  fairMarketValue: string
  description: string
  isStateContractorPrincipal: boolean
  contractorBranch: string
  isLobbyist: boolean
  eventId: string
  memo: string
}

function initial(c?: InKindContribution): FormState {
  return {
    entityType: c?.entityType ?? 'IS',
    lastName: c?.lastName ?? '',
    firstName: c?.firstName ?? '',
    middleInitial: c?.middleInitial ?? '',
    entityName: c?.entityName ?? '',
    street: c?.street ?? '',
    city: c?.city ?? '',
    state: c?.state ?? 'CT',
    zip: c?.zip ?? '',
    date: c?.date ?? new Date().toISOString().split('T')[0],
    fairMarketValue: c ? c.fairMarketValue.toFixed(2) : '',
    description: c?.description ?? '',
    isStateContractorPrincipal: c?.isStateContractorPrincipal ?? false,
    contractorBranch: c?.contractorBranch ?? 'E',
    isLobbyist: c?.isLobbyist ?? false,
    eventId: c?.eventId ?? '',
    memo: c?.memo ?? '',
  }
}

export default function InKindContributionDialog({
  open, onClose, onSave, committeeId, committeeSlug, contribution, events, duplicateFrom,
}: Props) {
  const isEdit = !!contribution
  const isDuplicate = !contribution && !!duplicateFrom
  const [form, setForm] = useState<FormState>(() =>
    contribution
      ? initial(contribution)
      : duplicateFrom
        // Copy every field but reset the date — a duplicate is a fresh donation.
        ? { ...initial(duplicateFrom), date: new Date().toISOString().split('T')[0] }
        : initial(undefined)
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const isIndividual = form.entityType === 'IS'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fmv = parseFloat(form.fairMarketValue)
    if (!form.lastName.trim()) return setError(isIndividual ? 'Last name is required' : 'Name is required')
    if (!form.description.trim()) return setError('Description is required')
    if (isNaN(fmv) || fmv <= 0) return setError('Enter a valid fair market value')
    if (!form.date) return setError('Date is required')

    setSaving(true)
    setError('')
    const payload: InKindContributionInput = {
      entityType: form.entityType,
      lastName: form.lastName.trim(),
      firstName: isIndividual ? form.firstName.trim() || undefined : undefined,
      middleInitial: isIndividual ? form.middleInitial.trim() || undefined : undefined,
      entityName: !isIndividual ? form.entityName.trim() || undefined : undefined,
      street: form.street.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || 'CT',
      zip: form.zip.trim() || undefined,
      date: form.date,
      fairMarketValue: fmv,
      description: form.description.trim(),
      isStateContractorPrincipal: form.isStateContractorPrincipal,
      contractorBranch: form.isStateContractorPrincipal ? form.contractorBranch : undefined,
      isLobbyist: form.isLobbyist,
      eventId: form.eventId || undefined,
      memo: form.memo.trim() || undefined,
    }
    try {
      const saved = isEdit
        ? await updateInKindContribution(contribution!.id, payload, committeeSlug)
        : await createInKindContribution(committeeId, payload, committeeSlug)
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
              {isEdit ? 'Edit in-kind contribution' : isDuplicate ? 'Duplicate in-kind contribution' : 'Add in-kind contribution'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Donated goods or services (SEEC Section M)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <Field label="Contributor type" required>
            <select value={form.entityType} onChange={(e) => set('entityType', e.target.value as InKindEntityType)} className={inputCls}>
              {(Object.keys(IN_KIND_ENTITY_LABELS) as InKindEntityType[]).map((t) => (
                <option key={t} value={t}>{IN_KIND_ENTITY_LABELS[t]}</option>
              ))}
            </select>
          </Field>

          {isIndividual ? (
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2"><Field label="Last name" required><input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Smith" className={inputCls} /></Field></div>
              <div className="col-span-2"><Field label="First name"><input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" className={inputCls} /></Field></div>
              <Field label="M.I."><input value={form.middleInitial} onChange={(e) => set('middleInitial', e.target.value)} maxLength={1} className={inputCls} /></Field>
            </div>
          ) : (
            <>
              <Field label="Name" required><input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Acme Signs LLC" className={inputCls} /></Field>
              <Field label="Committee name (if applicable)"><input value={form.entityName} onChange={(e) => set('entityName', e.target.value)} placeholder="Madison DTC" className={inputCls} /></Field>
            </>
          )}

          <Field label="Street address"><input value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="14 Whitfield Street" className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Guilford" className={inputCls} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} className={inputCls} /></Field>
            <Field label="ZIP"><input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="06437" className={inputCls} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date received" required><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} /></Field>
            <Field label="Fair market value ($)" required><input type="text" inputMode="decimal" value={form.fairMarketValue} onChange={(e) => set('fairMarketValue', e.target.value)} placeholder="0.00" className={inputCls} /></Field>
          </div>

          <Field label="Description of goods/services" required>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Printing of 500 palm cards" className={inputCls} maxLength={100} />
          </Field>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isStateContractorPrincipal} onChange={(e) => set('isStateContractorPrincipal', e.target.checked)} className={`${checkCls} mt-0.5`} />
              <span className="text-xs text-slate-600">Contributor is a principal of a state contractor / prospective state contractor</span>
            </label>
            {form.isStateContractorPrincipal && (
              <Field label="Contract branch">
                <select value={form.contractorBranch} onChange={(e) => set('contractorBranch', e.target.value)} className={inputCls}>
                  <option value="E">Executive</option>
                  <option value="L">Legislative</option>
                  <option value="B">Both</option>
                </select>
              </Field>
            )}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isLobbyist} onChange={(e) => set('isLobbyist', e.target.checked)} className={`${checkCls} mt-0.5`} />
              <span className="text-xs text-slate-600">Contributor is a lobbyist (or spouse/dependent child of one)</span>
            </label>
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

          <Field label="Internal note (optional)"><input value={form.memo} onChange={(e) => set('memo', e.target.value)} placeholder="Any additional details" className={inputCls} /></Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
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
