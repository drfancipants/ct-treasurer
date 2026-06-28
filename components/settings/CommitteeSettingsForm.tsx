'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import type { Committee } from '@/lib/types'
import { updateCommittee } from '@/actions/committees'

interface Props {
  committee: Committee
}

interface FormData {
  name: string
  seecId: string
  anedotAccountId: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  electionYear: string
}

export default function CommitteeSettingsForm({ committee }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>({
    name: committee.name,
    seecId: committee.seecId ?? '',
    anedotAccountId: committee.anedotAccountId ?? '',
    address1: committee.address1 ?? '',
    address2: committee.address2 ?? '',
    city: committee.city ?? '',
    state: committee.state ?? 'CT',
    zip: committee.zip ?? '',
    phone: committee.phone ?? '',
    email: committee.email ?? '',
    electionYear: committee.electionYear?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormData>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Committee name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateCommittee(
        committee.id,
        {
          name: form.name.trim(),
          seecId: form.seecId.trim() || undefined,
          anedotAccountId: form.anedotAccountId.trim() || undefined,
          address1: form.address1.trim() || undefined,
          address2: form.address2.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || 'CT',
          zip: form.zip.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          electionYear: form.electionYear ? parseInt(form.electionYear) : undefined,
        },
        committee.slug
      )
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Committee identity */}
      <Section title="Committee identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Committee name" required className="sm:col-span-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={inputCls}
              placeholder="e.g. Friends of Jane Smith"
            />
          </Field>

          <Field label="SEEC registration ID">
            <input
              type="text"
              value={form.seecId}
              onChange={(e) => set('seecId', e.target.value)}
              className={inputCls}
              placeholder="e.g. CT-DTC-20240142"
            />
          </Field>

          <Field label="Election year">
            <input
              type="number"
              value={form.electionYear}
              onChange={(e) => set('electionYear', e.target.value)}
              className={inputCls}
              placeholder={new Date().getFullYear().toString()}
              min={2000}
              max={2100}
            />
          </Field>
        </div>
      </Section>

      {/* Contact & address */}
      <Section title="Contact & address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
              placeholder="committee@example.com"
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={inputCls}
              placeholder="203-555-0100"
            />
          </Field>

          <Field label="Street address" className="sm:col-span-2">
            <input
              type="text"
              value={form.address1}
              onChange={(e) => set('address1', e.target.value)}
              className={inputCls}
              placeholder="123 Main St"
            />
          </Field>

          <Field label="Address line 2" className="sm:col-span-2">
            <input
              type="text"
              value={form.address2}
              onChange={(e) => set('address2', e.target.value)}
              className={inputCls}
              placeholder="Suite 100 (optional)"
            />
          </Field>

          <Field label="City">
            <input
              type="text"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className={inputCls}
              placeholder="New Haven"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <input
                type="text"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                className={inputCls}
                maxLength={2}
                placeholder="CT"
              />
            </Field>

            <Field label="ZIP">
              <input
                type="text"
                value={form.zip}
                onChange={(e) => set('zip', e.target.value)}
                className={inputCls}
                placeholder="06511"
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* Integrations */}
      <Section title="Integrations">
        <Field
          label="Anedot account ID"
          hint="Found in your Anedot dashboard → Settings → Account. Used to route webhook donations to this committee."
        >
          <input
            type="text"
            value={form.anedotAccountId}
            onChange={(e) => set('anedotAccountId', e.target.value)}
            className={inputCls}
            placeholder="e.g. acct_abc123"
          />
        </Field>
      </Section>

      {/* Save bar */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </span>
        )}

        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
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
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
