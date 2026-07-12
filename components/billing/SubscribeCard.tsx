'use client'

import { useState } from 'react'
import { Scale, Check, Loader2, LogOut } from 'lucide-react'
import type { Committee } from '@/lib/types'

const FEATURES = [
  'Party & candidate committees',
  'Donation & expense tracking with SEEC compliance flags',
  'Contribution limit tracking (incl. CEP)',
  'Bank sync & reconciliation',
  'Form 20 & Form 30 generation for eCRIS',
]

export default function SubscribeCard({
  committee,
  canManageBilling,
}: {
  committee: Committee
  canManageBilling: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resubscribe = committee.subscriptionStatus === 'canceled' || committee.subscriptionStatus === 'past_due'

  async function startCheckout() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committeeId: committee.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-3">
          <Scale className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          {resubscribe ? 'Reactivate' : 'Activate'} {committee.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {resubscribe
            ? 'This committee’s subscription has ended. Resubscribe to restore access.'
            : 'Each committee needs its own subscription. Start a 14-day free trial to begin.'}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-semibold text-slate-900">$9.99</span>
          <span className="text-sm text-slate-500">/ month per committee</span>
        </div>

        <ul className="space-y-2 mb-6">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        {canManageBilling ? (
          <button
            onClick={startCheckout}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {resubscribe ? 'Resubscribe' : 'Start 14-day free trial'}
          </button>
        ) : (
          <p className="text-sm text-slate-500 text-center">
            Ask this committee’s treasurer to start the subscription.
          </p>
        )}

        {!resubscribe && canManageBilling && (
          <p className="text-[11px] text-slate-400 text-center mt-3">
            No charge for 14 days. Cancel anytime before then and you won’t be billed.
          </p>
        )}
      </div>

      <a
        href="/app"
        className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mt-4"
      >
        <LogOut className="w-3 h-3" />
        Back to your committees
      </a>
    </div>
  )
}
