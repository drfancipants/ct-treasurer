'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Scale, Lock, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/forgot-password')
        return
      }
      setChecking(false)
    }
    checkSession()
  // router is stable; supabase is created locally — no external deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setDone(true)
      setTimeout(() => router.push('/app'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
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
          <h2 className="text-base font-semibold text-slate-900 mb-1">Password updated</h2>
          <p className="text-sm text-slate-500">
            Taking you to your committee…
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            New password <span className="text-red-500">*</span>
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
              autoFocus
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Confirm new password <span className="text-red-500">*</span>
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
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center mb-3">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">CT Committee</h1>
          <p className="text-sm text-slate-400">Treasurer Suite</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Set a new password</h2>
          <p className="text-xs text-slate-500 mb-5">
            Choose a new password for your account.
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
