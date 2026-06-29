'use client'

import { useState } from 'react'
import { AlertTriangle, XCircle, Loader2, X } from 'lucide-react'
import type { Committee } from '@/lib/types'

export default function SubscriptionBanner({ committee }: { committee: Committee }) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const status = committee.subscriptionStatus
  if (!status || status === 'trialing' || status === 'active' || dismissed) return null

  const isPastDue = status === 'past_due'

  async function handlePortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committeeId: committee.id }),
      })
      const data = await res.json()
      if (res.ok && data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isPastDue ? 'bg-amber-50 border-b border-amber-200 text-amber-800' : 'bg-red-50 border-b border-red-200 text-red-800'}`}>
      {isPastDue ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">
        {isPastDue
          ? 'Your last payment failed. Update your payment method to keep access.'
          : 'Your subscription has been canceled. Resubscribe to continue using the app.'}
      </span>
      <button
        onClick={handlePortal}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${isPastDue ? 'bg-amber-700 text-white hover:bg-amber-800' : 'bg-red-700 text-white hover:bg-red-800'} disabled:opacity-50`}
      >
        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        {isPastDue ? 'Update payment' : 'Resubscribe'}
      </button>
      <button onClick={() => setDismissed(true)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
