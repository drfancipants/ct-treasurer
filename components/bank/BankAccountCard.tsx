'use client'

import { useState } from 'react'
import { RefreshCw, MoreHorizontal, Trash2, CheckCircle2 } from 'lucide-react'
import type { BankAccount } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Props {
  account: BankAccount
  onSync: (accountId: string) => Promise<void>
  onRemove: (accountId: string) => void
}

export default function BankAccountCard({ account, onSync, onRemove }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      await onSync(account.id)
      setSyncResult('Up to date')
      setTimeout(() => setSyncResult(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const lastSynced = account.lastSyncedAt
    ? `Synced ${formatDistanceToNow(parseISO(account.lastSyncedAt), { addSuffix: true })}`
    : 'Never synced'

  // Older rows stored the raw Plaid institution id (e.g. "ins_109509")
  const institution = /^ins_\d+$/i.test(account.institution)
    ? 'Linked bank'
    : account.institution

  return (
    <div className="relative bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-6 text-white overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-white" />
        <div className="absolute top-8 right-8 w-20 h-20 rounded-full border-2 border-white" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-blue-300 font-medium uppercase tracking-wide mb-1">
              {institution}
            </p>
            <p className="text-sm text-slate-300">
              {account.name} ···· {account.lastFour}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4 text-slate-300" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => { onRemove(account.id); setMenuOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="mb-6">
          <p className="text-xs text-blue-300 uppercase tracking-wide mb-1">Current balance</p>
          <p className="text-3xl font-semibold tabular tracking-tight">
            {formatCurrency(account.currentBalance)}
          </p>
          {account.availableBalance !== undefined &&
            account.availableBalance !== account.currentBalance && (
              <p className="text-xs text-slate-400 mt-1">
                {formatCurrency(account.availableBalance)} available
              </p>
            )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {syncResult ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">{syncResult}</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">{lastSynced}</span>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs text-white font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>
    </div>
  )
}
