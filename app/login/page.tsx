'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scale, Mail, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { REMEMBER_ME_COOKIE, REMEMBERED_MAX_AGE, applyRememberMeCookiePolicy } from '@/lib/session'

type Mode = 'password' | 'magic-link'

/**
 * Sanitized post-login redirect target, read from the URL at call time rather
 * than via useSearchParams(). Using the hook forces the whole page to render
 * only its Suspense fallback on the server — which contained no input fields,
 * so any hydration hiccup (a blocked JS bundle on a locked-down browser, say)
 * left the user staring at a card with no sign-in fields. Reading it here keeps
 * the form in the server-rendered HTML so the fields always appear.
 */
function getRedirectTo(): string {
  if (typeof window === 'undefined') return '/app'
  const raw = new URLSearchParams(window.location.search).get('redirectTo') || ''
  return raw.startsWith('/') && !raw.startsWith('//') && raw !== '/' ? raw : '/app'
}

export default function LoginPage() {
  return <LoginForm />
}

function LoginForm() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Surface the failed-callback message after mount, so reading the URL never
  // pulls the form out of the server-rendered HTML (see getRedirectTo). Setting
  // state in the effect (rather than a lazy initializer) is deliberate: the
  // server can't read window, so initializing from the URL would render a
  // different tree on the client and trip a hydration mismatch.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'auth_callback_failed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setError(
        'That sign-in link couldn’t be completed. Magic links only work in the browser where you requested them — request a new one below, or sign in with your password.'
      )
    }
  }, [])

  /** Marks whether this login should persist past a browser restart — read
   * by the server client and proxy.ts on every later request so a
   * session-only choice isn't silently upgraded back to persistent. */
  function setRememberMeCookie(remember: boolean) {
    document.cookie = remember
      ? `${REMEMBER_ME_COOKIE}=1; path=/; max-age=${REMEMBERED_MAX_AGE}; samesite=lax`
      : `${REMEMBER_ME_COOKIE}=0; path=/; samesite=lax`
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    setRememberMeCookie(rememberMe)
    const { error } = await createClient().auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      applyRememberMeCookiePolicy(rememberMe)
      router.push(getRedirectTo())
      router.refresh()
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    setRememberMeCookie(rememberMe)
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${getRedirectTo()}`,
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  if (magicLinkSent) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Check your email</h2>
          <p className="text-sm text-slate-500 max-w-xs">
            We sent a sign-in link to <strong>{email}</strong>. Click it to access your account — no password needed.
          </p>
          <button
            onClick={() => { setMagicLinkSent(false); setMode('password') }}
            className="mt-5 text-xs text-blue-600 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <noscript>
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Signing in requires JavaScript. If the fields below don’t work, your browser or network
          may be blocking scripts — try a different browser, or ask your IT department to allow this site.
        </div>
      </noscript>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
        {(['password', 'magic-link'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError('') }}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'password' ? 'Password' : 'Magic link'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={mode === 'password' ? handlePasswordSignIn : handleMagicLink} className="space-y-4">
        {/* Email */}
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
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
        </div>

        {/* Password (password mode only) */}
        {mode === 'password' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700">Password</label>
              <a href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>
        )}

        {mode === 'magic-link' && (
          <p className="text-xs text-slate-500">
            We&apos;ll send a one-click sign-in link to your email. No password required.
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Remember me on this device for 30 days
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {mode === 'password' ? 'Sign in' : 'Send magic link'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-400">
        Access is by invitation only. Contact your committee treasurer to request access.
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center mb-3">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">CT Committee</h1>
          <p className="text-sm text-slate-400">Treasurer Suite</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Sign in</h2>
          <p className="text-xs text-slate-500 mb-5">
            Access your committee&apos;s financial records
          </p>
          {children}
        </div>

        <p className="mt-5 text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Sign up free
          </a>
        </p>
      </div>
    </div>
  )
}
