'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Scale, User, Lock, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, type MemberRole } from '@/lib/types'

interface InviteMetadata {
  committeeId?: string
  committeeName?: string
  role?: MemberRole
  name?: string
}

export default function AcceptInvitePage() {
  const router = useRouter()

  const [metadata, setMetadata] = useState<InviteMetadata>({})
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const meta = (user.user_metadata ?? {}) as InviteMetadata
      setMetadata(meta)
      setFullName(meta.name ?? '')
      setChecking(false)
    }
    loadUser()
  // router is stable; supabase is created locally — no external deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)

    try {
      const supabase = createClient()
      // 1. Update the user's password and display name
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { name: fullName.trim() },
      })
      if (updateError) throw updateError

      // 2. CommitteeMembership is created by /api/invite at invite time.
      //    Nothing more to write here.

      setDone(true)

      // Redirect to their committee after a brief success moment
      setTimeout(() => {
        if (metadata.committeeId) {
          router.push(`/app`)
        } else {
          router.push('/app')
        }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0F2147] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">You're all set!</h2>
          <p className="text-sm text-slate-500">
            Taking you to your committee…
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {/* Invite context */}
      {(metadata.committeeName || metadata.role) && (
        <div className="mb-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">
            You've been invited to join
          </p>
          {metadata.committeeName && (
            <p className="text-sm font-semibold text-blue-900 mt-0.5">
              {metadata.committeeName}
            </p>
          )}
          {metadata.role && (
            <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
              {ROLE_LABELS[metadata.role]}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Confirm password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Accept invitation'
          )}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0F2147] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center mb-3">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">CT Committee</h1>
          <p className="text-sm text-slate-400">Treasurer Suite</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Complete your account</h2>
          <p className="text-xs text-slate-500 mb-5">
            Set your name and password to finish joining your committee.
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
