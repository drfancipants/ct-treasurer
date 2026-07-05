'use client'

import { useState } from 'react'
import { Scale, Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Check your email</h2>
          <p className="text-sm text-slate-500 max-w-xs">
            If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
          </p>
          <a href="/login" className="mt-5 text-xs text-blue-600 hover:underline">
            Back to sign in
          </a>
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
          <label className="block text-xs font-medium text-slate-700">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
            <>
              Send reset link
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-400">
        <a href="/login" className="text-blue-600 hover:underline">
          Back to sign in
        </a>
      </p>
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
          <h2 className="text-base font-semibold text-slate-900 mb-1">Reset your password</h2>
          <p className="text-xs text-slate-500 mb-5">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
