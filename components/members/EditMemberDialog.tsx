'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CommitteeMember } from '@/lib/types'
import { updateMember } from '@/actions/members'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (member: CommitteeMember) => void
  committeeSlug: string
  member: CommitteeMember
}

export default function EditMemberDialog({ open, onClose, onSave, committeeSlug, member }: Props) {
  const [name, setName] = useState(member.name)
  const [phone, setPhone] = useState(member.phone ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required')

    setError('')
    setSaving(true)
    try {
      const updated = await updateMember(member.id, { name: name.trim(), phone: phone.trim() || undefined }, committeeSlug)
      onSave(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit member</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update their name and phone number</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Full name<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Email address</label>
            <input
              type="email"
              value={member.email}
              disabled
              className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`}
            />
            <p className="text-xs text-slate-400">
              Email is tied to their sign-in and can&apos;t be changed here — remove and re-invite if it&apos;s wrong.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="203-555-0100"
              className={inputCls}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
