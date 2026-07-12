'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePlaidLink } from 'react-plaid-link'
import { Loader2, Building2, AlertCircle } from 'lucide-react'
import { PLAID_OAUTH_KEY } from '@/components/bank/PlaidLinkButton'

// Plaid's OAuth redirect lands here (a fixed, dashboard-registered URI). We
// resume the original Link flow with the token stashed before the redirect,
// then run the normal token exchange and send the user back to their bank page.

const MAX_AGE_MS = 30 * 60 * 1000 // link tokens are short-lived; ignore stale state

interface StoredLink {
  token: string
  committeeId: string
  returnPath: string
  ts: number
}

type Resume =
  | { status: 'loading' }
  | { status: 'ready'; data: StoredLink }
  | { status: 'error'; message: string }

export default function PlaidOAuthReturnPage() {
  const router = useRouter()
  const [resume, setResume] = useState<Resume>({ status: 'loading' })
  const stored = resume.status === 'ready' ? resume.data : null

  // localStorage can't be read during SSR, so this must run after mount; the
  // single setState reflects a browser-only value into React (see the same
  // pattern in app/login/page.tsx).
  useEffect(() => {
    let next: Resume
    try {
      const raw = localStorage.getItem(PLAID_OAUTH_KEY)
      if (!raw) {
        next = { status: 'error', message: 'We couldn’t find your in-progress connection. Please start again from your bank page.' }
      } else {
        const parsed = JSON.parse(raw) as StoredLink
        if (!parsed.token || Date.now() - parsed.ts > MAX_AGE_MS) {
          localStorage.removeItem(PLAID_OAUTH_KEY)
          next = { status: 'error', message: 'This connection attempt expired. Please start again from your bank page.' }
        } else {
          next = { status: 'ready', data: parsed }
        }
      }
    } catch {
      next = { status: 'error', message: 'We couldn’t resume your connection. Please start again from your bank page.' }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only read, see comment above
    setResume(next)
  }, [])

  const error = resume.status === 'error' ? resume.message : null

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      const target = stored?.returnPath || '/app'
      try {
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken, committeeId: stored!.committeeId }),
        })
      } catch {
        // Local exchange failed; the bank page will simply show no new account
      } finally {
        localStorage.removeItem(PLAID_OAUTH_KEY)
        router.push(target)
        router.refresh()
      }
    },
    [stored, router]
  )

  const { open, ready } = usePlaidLink({
    token: stored?.token ?? null,
    // Only resume once we have the stored token. Passing receivedRedirectUri
    // without a matching token/OAuth state makes Link fail to initialize and
    // fire onExit — which would bounce the user to /app before the error UI
    // below ever renders. The full return URL carries Plaid's oauth_state_id.
    receivedRedirectUri:
      stored && typeof window !== 'undefined' ? window.location.href : undefined,
    onSuccess: handleSuccess,
    onExit: () => {
      localStorage.removeItem(PLAID_OAUTH_KEY)
      router.push(stored?.returnPath || '/app')
    },
  })

  useEffect(() => {
    if (stored && ready) open()
  }, [stored, ready, open])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Connection interrupted</h1>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Back to your committees
            </Link>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Finishing your bank connection…</h1>
            <p className="text-sm text-slate-500">Just a moment while we securely complete the link.</p>
          </>
        )}
      </div>
    </div>
  )
}
