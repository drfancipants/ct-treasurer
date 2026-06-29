'use client'

import { useState } from 'react'
import { CreditCard, CheckCircle2, AlertCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import type { Committee, SubscriptionStatus } from '@/lib/types'

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  trialing: { label: 'Free trial', color: 'text-blue-700 bg-blue-50 ring-blue-200', icon: CheckCircle2 },
  active:   { label: 'Active',      color: 'text-emerald-700 bg-emerald-50 ring-emerald-200', icon: CheckCircle2 },
  past_due: { label: 'Past due',    color: 'text-amber-700 bg-amber-50 ring-amber-200', icon: AlertCircle },
  canceled: { label: 'Canceled',    color: 'text-red-700 bg-red-50 ring-red-200', icon: XCircle },
}

export default function BillingCard({ committee }: { committee: Committee }) {
  const [loading, setLoading] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState('')

  const status = committee.subscriptionStatus
  const hasSubscription = !!committee.stripeSubscriptionId
  const isActive = status === 'active' || status === 'trialing'

  async function handleCheckout() {
    setLoading('checkout')
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committeeId: committee.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ committeeId: committee.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to open portal')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  const trialEnd = committee.trialEndsAt
    ? new Date(committee.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
          <CreditCard className="w-4.5 h-4.5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Billing</h3>
          <p className="text-xs text-slate-500">$9.99/month per committee</p>
        </div>
      </div>

      {status && (
        <div className="mb-4">
          {(() => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            return (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${cfg.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </span>
            )
          })()}
          {status === 'trialing' && trialEnd && (
            <p className="text-xs text-slate-500 mt-2">Your free trial ends on {trialEnd}.</p>
          )}
          {status === 'past_due' && (
            <p className="text-xs text-amber-700 mt-2">Your last payment failed. Update your payment method to avoid losing access.</p>
          )}
          {status === 'canceled' && (
            <p className="text-xs text-slate-500 mt-2">Your subscription has been canceled. Subscribe again to restore access.</p>
          )}
        </div>
      )}

      {!status && (
        <p className="text-sm text-slate-500 mb-4">
          Start a 14-day free trial — no credit card required until the trial ends.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="flex gap-2">
        {(!hasSubscription || status === 'canceled') && (
          <button
            onClick={handleCheckout}
            disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'checkout' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {hasSubscription ? 'Resubscribe' : 'Start free trial'}
          </button>
        )}
        {hasSubscription && status !== 'canceled' && (
          <button
            onClick={handlePortal}
            disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading === 'portal' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
            Manage billing
          </button>
        )}
      </div>

      {isActive && (
        <p className="text-xs text-slate-400 mt-3">
          Invoices, payment methods, and cancellation are managed through the Stripe billing portal.
        </p>
      )}
    </div>
  )
}
