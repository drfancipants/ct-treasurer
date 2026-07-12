'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Building2, Loader2 } from 'lucide-react'

interface Props {
  committeeId: string
  onSuccess: () => void
}

// Link state persisted across an OAuth redirect. When Link sends the browser
// to the bank and back to /app/plaid-oauth, this component is gone, so the
// return page reads this to resume the exact same link_token. Kept in module
// scope so the resume page can import the key.
export const PLAID_OAUTH_KEY = 'plaid_oauth_link'

export default function PlaidLinkButton({ committeeId, onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchLinkToken() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committeeId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start connection')
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true)
      try {
        // Non-OAuth flow resolves here in-page; clear any persisted OAuth state
        localStorage.removeItem(PLAID_OAUTH_KEY)
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken, committeeId }),
        })
        onSuccess()
      } catch {
        setError('Failed to link account. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [committeeId, onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => {
      localStorage.removeItem(PLAID_OAUTH_KEY)
      setLinkToken(null)
      setLoading(false)
    },
  })

  useEffect(() => {
    if (linkToken && ready) {
      // Persist before opening: an OAuth institution navigates the browser away
      // to the bank, so the return page needs this token + committee to resume.
      // Harmless for non-OAuth links, which clear it on success/exit.
      try {
        localStorage.setItem(
          PLAID_OAUTH_KEY,
          JSON.stringify({
            token: linkToken,
            committeeId,
            returnPath: window.location.pathname,
            ts: Date.now(),
          })
        )
      } catch {
        // localStorage unavailable (private mode): OAuth resume won't work, but
        // non-OAuth linking still does, so proceed.
      }
      open()
    }
  }, [linkToken, ready, open, committeeId])

  return (
    <div>
      <button
        onClick={fetchLinkToken}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Building2 className="w-4 h-4" />
        )}
        {loading ? 'Connecting…' : 'Connect bank account'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
