'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import type { Contribution, PaymentMethod, CommitteeEvent } from '@/lib/types'
import { createContribution, updateContribution } from '@/actions/donations'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { checkProspective, CASH_CONTRIBUTION_MAX, PARTY_POLICY, type LimitPolicy } from '@/lib/limits'
import { formatCurrency, formatDate } from '@/lib/utils'

/** "for 2026" (party, year bucket) vs "toward the primary" (candidate phase). */
function bucketPhrase(policy: LimitPolicy, bucketLabel: string): string {
  return policy.kind === 'PARTY' ? `for ${bucketLabel}` : `toward the ${bucketLabel.toLowerCase()}`
}

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (contribution: Contribution) => void
  committeeId: string
  committeeSlug: string
  contribution?: Contribution // pre-fills the form for edit mode
  existingContributions?: Contribution[] // for the annual-limit check
  events?: CommitteeEvent[] // for the optional event link
  /** Seeds the form for a new (non-edit) donation — e.g. reconciling a bank transaction. Ignored when `contribution` is set. */
  initialValues?: Partial<{ amount: number; date: string }>
  /** Pre-fills a NEW donation from an existing one (donor + details copied, date reset to today), so the user can tweak and save it as a separate record. Ignored when `contribution` is set. */
  duplicateFrom?: Contribution
  policy?: LimitPolicy
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
  isStateContractor: boolean
  contractorBranch: string
  isLobbyist: boolean
  // Contributor
  firstName: string
  middleInitial: string
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
  isStateContractor: false,
  contractorBranch: 'E',
  isLobbyist: false,
  firstName: '',
  middleInitial: '',
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

/** Maps an existing contribution onto the editable form fields. */
function formFromContribution(c: Contribution): FormData {
  return {
    amount: c.amount.toFixed(2),
    date: c.date,
    method: c.method,
    checkNumber: c.checkNumber ?? '',
    isItemized: c.isItemized,
    memo: c.memo ?? '',
    eventId: c.eventId ?? '',
    isStateContractor: c.isStateContractor ?? false,
    contractorBranch: c.contractorBranch ?? 'E',
    isLobbyist: c.isLobbyist ?? false,
    firstName: c.contributor.firstName,
    middleInitial: c.contributor.middleInitial ?? '',
    lastName: c.contributor.lastName,
    email: c.contributor.email ?? '',
    address1: c.contributor.address1,
    address2: c.contributor.address2 ?? '',
    city: c.contributor.city,
    state: c.contributor.state,
    zip: c.contributor.zip,
    employer: c.contributor.employer ?? '',
    occupation: c.contributor.occupation ?? '',
  }
}

export default function AddDonationDialog({ open, onClose, onAdd, committeeId, committeeSlug, contribution, existingContributions, events = [], initialValues, duplicateFrom, policy = PARTY_POLICY }: Props) {
  const isEdit = !!contribution
  const isDuplicate = !contribution && !!duplicateFrom
  const [form, setForm] = useState<FormData>(
    contribution
      ? formFromContribution(contribution)
      : duplicateFrom
        // A duplicate is a brand-new gift: copy every field but reset the date
        // to today, so it isn't an accidental byte-for-byte clone.
        ? { ...formFromContribution(duplicateFrom), date: EMPTY.date }
        : {
            ...EMPTY,
            amount: initialValues?.amount !== undefined ? initialValues.amount.toFixed(2) : EMPTY.amount,
            date: initialValues?.date ?? EMPTY.date,
          }
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
          form.method,
          policy
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
          middleInitial: form.middleInitial.trim() || undefined,
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
        isStateContractor: form.isStateContractor,
        contractorBranch: form.isStateContractor ? form.contractorBranch : undefined,
        isLobbyist: form.isLobbyist,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? 'Edit donation' : isDuplicate ? 'Duplicate donation' : 'Record a donation'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDuplicate
                ? 'Copied from an existing donation — review and edit, then save as a new record'
                : 'All information is required for SEEC-compliant itemized contributions'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="px-6 py-5 space-y-6 overflow-y-auto">
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

                <div className="grid grid-cols-3 gap-3">
                  <Field label="M.I.">
                    <input
                      type="text"
                      value={form.middleInitial}
                      onChange={(e) => set('middleInitial', e.target.value.toUpperCase().slice(0, 1))}
                      maxLength={1}
                      className={inputCls(false)}
                    />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Last name" required error={errors.lastName}>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => set('lastName', e.target.value)}
                        placeholder="Smith"
                        className={inputCls(!!errors.lastName)}
                      />
                    </Field>
                  </div>
                </div>

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

              {/* SEEC disclosure questions (Form 20 Section B columns) */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isStateContractor}
                    onChange={(e) => set('isStateContractor', e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">
                    Contributor is a principal of a state contractor or prospective state contractor
                  </span>
                </label>
                {form.isStateContractor && (
                  <Field label="Contract branch">
                    <select
                      value={form.contractorBranch}
                      onChange={(e) => set('contractorBranch', e.target.value)}
                      className={inputCls(false)}
                    >
                      <option value="E">Executive</option>
                      <option value="L">Legislative</option>
                      <option value="B">Both</option>
                    </select>
                  </Field>
                )}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isLobbyist}
                    onChange={(e) => set('isLobbyist', e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">
                    Contributor is a communicator lobbyist (or spouse/dependent child of one)
                  </span>
                </label>
              </div>
            </section>
          </div>

          {limitCheck && (limitCheck.cashOverMax || limitCheck.cepBelowMin || limitCheck.priorTotal > 0 || limitCheck.status !== 'ok' || (policy.stateContractorProhibited && form.isStateContractor)) && (
            <div className="px-6 pb-4 space-y-2 shrink-0">
              {policy.stateContractorProhibited && form.isStateContractor && (
                <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  State contractor contributions are prohibited for Citizens’ Election Program participants.
                </p>
              )}
              {limitCheck.cashOverMax && (
                <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  Cash contributions over {formatCurrency(CASH_CONTRIBUTION_MAX)} are prohibited (CGS § 9-611) —
                  amounts above that must be by personal check or credit card.
                </p>
              )}
              {limitCheck.wouldExceed ? (
                <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  This would bring the donor to {formatCurrency(limitCheck.newTotal)} {bucketPhrase(policy, limitCheck.bucketLabel)} —
                  over the {limitCheck.limitLabel} individual limit.
                </p>
              ) : limitCheck.status === 'warning' ? (
                <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  With this donation the donor reaches {formatCurrency(limitCheck.newTotal)} of the{' '}
                  {formatCurrency(limitCheck.limit)} limit ({formatCurrency(limitCheck.remaining)} remaining).
                </p>
              ) : limitCheck.priorTotal > 0 ? (
                <p className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  This donor has given {formatCurrency(limitCheck.priorTotal)} {bucketPhrase(policy, limitCheck.bucketLabel)} —
                  {' '}{formatCurrency(limitCheck.remaining)} remaining under the limit after this donation.
                </p>
              ) : null}
              {limitCheck.cepBelowMin && (
                <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  Below the CEP qualifying minimum — this gift is legal to accept but won’t count toward qualifying funds.
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
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
