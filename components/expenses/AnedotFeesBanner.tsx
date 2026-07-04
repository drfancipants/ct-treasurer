'use client'

import { useState } from 'react'
import { Receipt, Loader2 } from 'lucide-react'
import type { Expenditure } from '@/lib/types'
import { recordAnedotFees, type UnrecordedFees } from '@/actions/expenses'
import { formatCurrency } from '@/lib/utils'

interface Props {
  fees: UnrecordedFees
  committeeId: string
  committeeSlug: string
  onRecorded: (created: Expenditure[]) => void
}

/**
 * Anedot withholds its fee before depositing, so the fees never show up as
 * bank transactions — but SEEC still expects them reported as expenditures.
 * This banner surfaces the accumulated unrecorded total with a one-click fix.
 */
export default function AnedotFeesBanner({ fees: initial, committeeId, committeeSlug, onRecorded }: Props) {
  const [fees, setFees] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (fees.count === 0) return null

  async function handleRecord() {
    setSaving(true)
    setError('')
    try {
      const created = await recordAnedotFees(committeeId, committeeSlug)
      onRecorded(created)
      setFees({ total: 0, count: 0 })
    } catch {
      setError('Failed to record fees. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 mb-4 rounded-xl bg-blue-50 border border-blue-200">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Receipt className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-blue-900">
            {formatCurrency(fees.total)} in Anedot processing fees not yet recorded as an expense
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Withheld from {fees.count} donation{fees.count !== 1 ? 's' : ''} before deposit — SEEC
            expects these reported as an expenditure (payee Anedot, purpose BNK). One expense is
            created per filing period so each lands in the right Form 20 — including any
            pre-election periods that split a quarter.
          </p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
      <button
        onClick={handleRecord}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
      >
        {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>) : 'Record as expense'}
      </button>
    </div>
  )
}
