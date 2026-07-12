'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scale, ShieldCheck, Loader2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/** Sanitized post-challenge redirect target (same pattern as the login page —
 * read at call time so the form stays in the server-rendered HTML). */
function getRedirectTo(): string {
  if (typeof window === 'undefined') return '/app'
  const raw = new URLSearchParams(window.location.search).get('redirectTo') || ''
  return raw.startsWith('/') && !raw.startsWith('//') && raw !== '/' ? raw : '/app'
}

export default function MfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      const factor = data?.totp.find((f) => f.status === 'verified')
      if (error || !factor) {
        // No verified factor — the proxy will route them onward
        router.replace(getRedirectTo())
        return
      }
      setFactorId(factor.id)
    })
  }, [router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setVerifying(true)
    setError('')

    const supabase = createClient()
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? 'Could not start verification. Try again.')
      setVerifying(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })
    if (verifyError) {
      setError('That code didn’t work. Check your authenticator app and try again.')
      setCode('')
      setVerifying(false)
      return
    }

    router.push(getRedirectTo())
    router.refresh()
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Two-factor authentication</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form onSubmit={handleVerify} className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 mb-4 text-blue-600">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-medium">Your account is protected by 2FA</span>
          </div>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            className="w-full text-center text-2xl tracking-[0.5em] font-mono border border-slate-300 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300"
          />

          {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}

          <button
            type="submit"
            disabled={verifying || !factorId || code.length !== 6}
            className="w-full mt-4 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Verify
          </button>
        </form>

        <p className="text-center mt-4">
          <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Sign in as a different user
          </button>
        </p>
      </div>
    </div>
  )
}
