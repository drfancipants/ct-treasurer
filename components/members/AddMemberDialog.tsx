'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CommitteeMember, MemberRole } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (member: CommitteeMember) => void
  committeeId: string
  committeeName: string
}

export default function AddMemberDialog({ open, onClose, onAdd, committeeId, committeeName }: Props) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'MEMBER' as MemberRole,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) return setError('Name is required')
    if (!form.email.trim()) return setError('Email is required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError('Enter a valid email address')
    }

    setSaving(true)
    try {
      // Send the invitation via Supabase
      // Falls back to simulated add if Supabase isn't configured
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          role: form.role,
          committeeId,
          committeeName,
        }),
      })

      const data = await res.json()

      if (!res.ok && res.status !== 503) {
        // 503 = Supabase not configured — fall through to mock add
        throw new Error(data.error ?? 'Failed to send invitation')
      }

      // Optimistically add to the local list
      const newMember: CommitteeMember = {
        id: `mem_${Date.now()}`,
        committeeId,
        userId: data.userId ?? `usr_${Date.now()}`,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        joinedAt: new Date().toISOString().split('T')[0],
      }
      onAdd(newMember)
      setForm({ name: '', email: '', phone: '', role: 'MEMBER' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setForm({ name: '', email: '', phone: '', role: 'MEMBER' })
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add committee member</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              They'll receive an invitation to create an account
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <Field label="Full name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Smith"
              className={inputCls}
              autoFocus
            />
          </Field>

          <Field label="Email address" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@example.com"
              className={inputCls}
            />
          </Field>

          <Field label="Phone (optional)">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="203-555-0100"
              className={inputCls}
            />
          </Field>

          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}
              className={inputCls}
            >
              {(Object.keys(ROLE_LABELS) as MemberRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>

          {/* Role explanation */}
          <RoleHint role={form.role} />

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
              {saving ? 'Sending invite…' : 'Send invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
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

function RoleHint({ role }: { role: MemberRole }) {
  const hints: Partial<Record<MemberRole, string>> = {
    TREASURER:
      'Full access. Responsible for SEEC filings and legally accountable to the state.',
    ASSISTANT_TREASURER: 'Can enter donations and expenses. Cannot file with SEEC.',
    CHAIRPERSON: 'Can view all data and manage members.',
    SECRETARY: 'Can view all data and enter basic records.',
    MEMBER: 'Can view financial summaries.',
    VIEWER: 'Read-only access to dashboards.',
  }
  const hint = hints[role]
  if (!hint) return null
  return <p className="text-xs text-slate-500 -mt-1">{hint}</p>
}
