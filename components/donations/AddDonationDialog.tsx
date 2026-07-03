'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import type { Contribution, PaymentMethod, CommitteeEvent } from '@/lib/types'
import { createContribution, updateContribution } from '@/actions/donations'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { checkProspective, INDIVIDUAL_ANNUAL_LIMIT, CASH_CONTRIBUTION_MAX } from '@/lib/limits'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (contribution: Contribution) => void
  committeeId: string
  committeeSlug: string
  contribution?: Contribution // pre-fills the form for edit mode
  existingContributions?: Contribution[] // for the annual-limit check
  events?: CommitteeEvent[] // for the optional event link
}

interface FormData {
  // Contribution
  amount: string
  date: string
  method: PaymentMethod
  checkNumber: string
  isItemized: boolean
  memo: string
  eventId: string
  // Contributor
  firstName: string
  lastName: string
  email: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  employer: string
  occupation: string
}

const EMPTY: FormData = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  method: 'CHECK',
  checkNumber: '',
  isItemized: true,
  memo: '',
  eventId: '',
  firstName: '',
  lastName: '',
  email: '',
  address1: '',
  address2: '',
  city: '',
  state: 'CT',
  zip: '',
  employer: '',
  occupation: '',
}

export default function AddDonationDialog({ open, onClose, onAdd, committeeId, committeeSlug, contribution, existingContributions, events = [] }: Props) {
  const isEdit = !!contribution
  const [form, setForm] = useState<FormData>(
    contribution
      ? {
          amount: contribution.amount.toFixed(2),
          date: contribution.date,
          method: contribution.method,
          checkNumber: contribution.checkNumber ?? '',
          isItemized: contribution.isItemized,
          memo: contribution.memo ?? '',
          eventId: contribution.eventId ?? '',
          firstName: contribution.contributor.firstName,
          lastName: contribution.contributor.lastName,
          email: contribution.contributor.email ?? '',
          address1: contribution.contributor.address1,
          address2: contribution.contributor.address2 ?? '',
          city: contribution.contributor.city,
          state: contribution.contributor.state,
          zip: contribution.contributor.zip,
          employer: contribution.contributor.employer ?? '',
          occupation: contribution.contributor.occupation ?? '',
        }
      : EMPTY
  )
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)

  if (!open) return null

  // Annual-limit check against everything except the contribution being edited
  const parsedAmount = parseFloat(form.amount)
  const limitCheck =
    !isNaN(parsedAmount) && parsedAmount > 0 && (form.firstName || form.email)
      ? checkProspective(
          (existingContributions ?? []).filter((c) => c.id !== contribution?.id),
          { email: form.email || undefined, firstName: form.firstName, lastName: form.lastName, zip: form.zip },
          parsedAmount,
          form.date,
          form.method
        )
      : null

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}

    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) e.amount = 'Enter a valid amount'
    if (!form.date) e.date = 'Date is required'
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.address1.trim()) e.address1 = 'Required'
    if (!form.city.trim()) e.city = 'Required'
    if (!form.zip.trim()) e.zip = 'Required'

    // SEEC: employer + occupation required for itemized contributions ≥ $50
    if (form.isItemized && amount >= 50) {
      if (!form.employer.trim()) e.employer = 'Required by SEEC for itemized contributions'
      if (!form.occupation.trim()) e.occupation = 'Required by SEEC for itemized contributions'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        contributor: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          address1: form.address1.trim(),
          address2: form.address2.trim() || undefined,
          city: form.city.trim(),
          state: form.state,
          zip: form.zip.trim(),
          employer: form.employer.trim() || undefined,
          occupation: form.occupation.trim() || undefined,
        },
        amount: parseFloat(form.amount),
        date: form.date,
        method: form.method,
        checkNumber: form.checkNumber.trim() || undefined,
        eventId: form.eventId || undefined,
        memo: form.memo.trim() || undefined,
        isItemized: form.isItemized,
      }

      const saved = isEdit && contribution
        ? await updateContribution(contribution.id, contribution.contributor.id, payload, committeeSlug)
        : await createContribution(committeeId, payload, committeeSlug)

      onAdd(saved)
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

  const amount = parseFloat(form.amount)
  const showSeecWarning =
    form.isItemized &&
    !isNaN(amount) &&
    amount >= 50 &&
    (!form.employer || !form.occupation)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? 'Edit donation' : 'Record a donation'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All information is required for SEEC-compliant itemized contributions
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6">
            {/* ── Contribution details ────────────────────────────────── */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Contribution details
              </h3>
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

                <Field label="Payment method" required>
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

                {form.method === 'CHECK' && (
                  <Field label="Check number">
                    <input
                      type="text"
                      value={form.checkNumber}
                      onChange={(e) => set('checkNumber', e.target.value)}
                      placeholder="e.g. 1042"
                      className={inputCls(false)}
                    />
                  </Field>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isItemized}
                    onChange={(e) => set('isItemized', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Itemized contribution</span>
                </label>
                <span className="text-xs text-slate-400">
                  (required for individual contributions ≥ $50)
                </span>
              </div>

              <Field label="Memo / note" className="mt-4">
                <input
                  type="text"
                  value={form.memo}
                  onChange={(e) => set('memo', e.target.value)}
                  placeholder="Optional internal note"
                  className={inputCls(false)}
                />
              </Field>

              {events.length > 0 && (
                <Field label="Linked event (optional)" className="mt-4">
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
            </section>

            {/* ── Contributor information ─────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Contributor information
                </h3>
                {showSeecWarning && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    SEEC requires employer &amp; occupation for amounts ≥ $50
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" required error={errors.firstName}>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="Jane"
                    className={inputCls(!!errors.firstName)}
                  />
                </Field>

                <Field label="Last name" required error={errors.lastName}>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Smith"
                    className={inputCls(!!errors.lastName)}
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="jane@example.com"
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="Street address" required error={errors.address1} className="col-span-2">
                  <input
                    type="text"
                    value={form.address1}
                    onChange={(e) => set('address1', e.target.value)}
                    placeholder="14 Whitfield Street"
                    className={inputCls(!!errors.address1)}
                  />
                </Field>

                <Field label="Address line 2">
                  <input
                    type="text"
                    value={form.address2}
                    onChange={(e) => set('address2', e.target.value)}
                    placeholder="Apt, Suite, etc."
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="City" required error={errors.city}>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="Guilford"
                    className={inputCls(!!errors.city)}
                  />
                </Field>

                <Field label="State" required>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => set('state', e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="CT"
                    maxLength={2}
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="ZIP code" required error={errors.zip}>
                  <input
                    type="text"
                    value={form.zip}
                    onChange={(e) => set('zip', e.target.value)}
                    placeholder="06437"
                    maxLength={10}
                    className={inputCls(!!errors.zip)}
                  />
                </Field>

                <Field
                  label="Employer"
                  required={form.isItemized && !isNaN(amount) && amount >= 50}
                  error={errors.employer}
                >
                  <input
                    type="text"
                    value={form.employer}
                    onChange={(e) => set('employer', e.target.value)}
                    placeholder="Yale-New Haven Hospital"
                    className={inputCls(!!errors.employer)}
                  />
                </Field>

                <Field
                  label="Occupation"
                  required={form.isItemized && !isNaN(amount) && amount >= 50}
                  error={errors.occupation}
                >
                  <input
                    type="text"
                    value={form.occupation}
                    onChange={(e) => set('occupation', e.target.value)}
                    placeholder="Physician"
                    className={inputCls(!!errors.occupation)}
                  />
                </Field>
              </div>
            </section>
          </div>

          {limitCheck && (limitCheck.cashOverMax || limitCheck.priorTotal > 0 || limitCheck.status !== 'ok') && (
            <div className="px-6 pb-4 space-y-2">
              {limitCheck.cashOverMax && (
                <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  Cash contributions over {formatCurrency(CASH_CONTRIBUTION_MAX)} are prohibited (CGS § 9-611) —
                  amounts above that must be by personal check or credit card.
                </p>
              )}
              {limitCheck.wouldExceed ? (
                <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  This would bring the donor to {formatCurrency(limitCheck.newTotal)} for {form.date.slice(0, 4)} —
                  over the {formatCurrency(INDIVIDUAL_ANNUAL_LIMIT)} individual annual limit for town committees.
                </p>
              ) : limitCheck.status === 'warning' ? (
                <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  With this donation the donor reaches {formatCurrency(limitCheck.newTotal)} of the{' '}
                  {formatCurrency(INDIVIDUAL_ANNUAL_LIMIT)} annual limit ({formatCurrency(limitCheck.remaining)} remaining).
                </p>
              ) : limitCheck.priorTotal > 0 ? (
                <p className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  This donor has given {formatCurrency(limitCheck.priorTotal)} in {form.date.slice(0, 4)} —
                  {' '}{formatCurrency(limitCheck.remaining)} remaining under the annual limit after this donation.
                </p>
              ) : null}
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save donation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function inputCls(hasError: boolean) {
  return [
    'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:border-transparent bg-white',
    hasError
      ? 'border-red-300 focus:ring-red-400'
      : 'border-slate-200 focus:ring-blue-500',
  ].join(' ')
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
