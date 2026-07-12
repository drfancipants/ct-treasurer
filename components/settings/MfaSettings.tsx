'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type View =
  | { state: 'loading' }
  | { state: 'disabled' }
  | { state: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { state: 'enabled'; factorId: string }

export default function MfaSettings() {
  const [view, setView] = useState<View>({ state: 'loading' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    createClient().auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp.find((f) => f.status === 'verified')
      setView(verified ? { state: 'enabled', factorId: verified.id } : { state: 'disabled' })
    })
  }, [])

  async function startEnrollment() {
    setBusy(true)
    setError('')
    const supabase = createClient()

    // Clear any stale unverified factors from abandoned enrollment attempts.
    // Note: listFactors().totp only contains *verified* factors — unverified
    // ones are only in `all`, and they block re-enrollment under the same
    // friendly name.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    const stale = existing?.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified') ?? []
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator app',
    })
    setBusy(false)
    if (error || !data) {
      setError(error?.message ?? 'Could not start enrollment. Try again.')
      return
    }
    setCode('')
    setView({ state: 'enrolling', factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault()
    if (view.state !== 'enrolling' || code.length !== 6) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: view.factorId,
    })
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? 'Could not verify. Try again.')
      setBusy(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: view.factorId,
      challengeId: challenge.id,
      code,
    })
    setBusy(false)
    if (verifyError) {
      setError('That code didn’t work. Scan the QR code again or re-enter the code from your app.')
      setCode('')
      return
    }
    setView({ state: 'enabled', factorId: view.factorId })
  }

  async function cancelEnrollment() {
    if (view.state !== 'enrolling') return
    const factorId = view.factorId
    setView({ state: 'disabled' })
    setError('')
    // Best-effort cleanup of the unverified factor
    await createClient().auth.mfa.unenroll({ factorId })
  }

  async function disable() {
    if (view.state !== 'enabled') return
    if (!window.confirm('Turn off two-factor authentication? Your account will be protected by your password alone.')) return
    setBusy(true)
    setError('')
    const { error } = await createClient().auth.mfa.unenroll({ factorId: view.factorId })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setView({ state: 'disabled' })
  }

  async function copySecret() {
    if (view.state !== 'enrolling') return
    await navigator.clipboard.writeText(view.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Two-factor authentication</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Require a 6-digit code from an authenticator app when signing in.
          </p>
        </div>
        {view.state === 'enabled' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            On
          </span>
        )}
      </div>

      {view.state === 'loading' && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      )}

      {view.state === 'disabled' && (
        <button
          onClick={startEnrollment}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Enable two-factor authentication
        </button>
      )}

      {view.state === 'enrolling' && (
        <form onSubmit={confirmEnrollment} className="mt-5 space-y-4">
          <ol className="text-sm text-slate-600 space-y-4 list-decimal pl-5">
            <li>
              Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy…):
              <div className="mt-2">
                <div className="bg-white border border-slate-200 rounded-xl p-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI from Supabase, not an optimizable asset */}
                  <img src={view.qrCode} alt="TOTP enrollment QR code" className="w-40 h-40" />
                </div>
              </div>
              <button
                type="button"
                onClick={copySecret}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                Can&apos;t scan? Copy the setup key
              </button>
            </li>
            <li>
              Enter the 6-digit code the app shows:
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-32 text-center font-mono tracking-widest border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300"
                />
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & turn on'}
                </button>
                <button
                  type="button"
                  onClick={cancelEnrollment}
                  className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </li>
          </ol>
        </form>
      )}

      {view.state === 'enabled' && (
        <div className="mt-4">
          <p className="text-sm text-slate-600">
            You&apos;ll be asked for a code from your authenticator app each time you sign in.
          </p>
          <button
            onClick={disable}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
            Turn off
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )
}
