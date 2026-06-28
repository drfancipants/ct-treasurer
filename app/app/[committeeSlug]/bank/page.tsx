'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import {
  MOCK_BANK_ACCOUNTS,
  MOCK_BANK_TRANSACTIONS,
  MOCK_CONTRIBUTIONS,
  MOCK_EXPENDITURES,
  getCommittee,
} from '@/lib/mock-data'
import type { BankAccount } from '@/lib/types'
import BankAccountCard from '@/components/bank/BankAccountCard'
import PlaidLinkButton from '@/components/bank/PlaidLinkButton'
import TransactionsTable from '@/components/bank/TransactionsTable'

// TODO: replace props with server-fetched data once DB is wired
// This page is 'use client' temporarily so it can manage account state.
// Convert to a server component + client islands once Prisma is connected.

export default function BankPage({ params }: { params: { committeeSlug: string } }) {
  const committee = getCommittee(params.committeeSlug)
  const committeeId = committee?.id ?? ''

  const [accounts, setAccounts] = useState<BankAccount[]>(
    MOCK_BANK_ACCOUNTS.filter((a) => a.committeeId === committeeId)
  )

  const transactions = MOCK_BANK_TRANSACTIONS.filter((t) =>
    accounts.some((a) => a.id === t.bankAccountId)
  )

  const contributions = MOCK_CONTRIBUTIONS.filter((c) => c.committeeId === committeeId)
  const expenditures = MOCK_EXPENDITURES.filter((e) => e.committeeId === committeeId)

  async function handleSync(accountId: string) {
    const res = await fetch('/api/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccountId: accountId }),
    })
    const data = await res.json()
    console.log('[sync]', data)
    // Update lastSyncedAt on the account card
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, lastSyncedAt: new Date().toISOString() } : a
      )
    )
  }

  function handleRemove(accountId: string) {
    // TODO: await removeAccount(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Bank accounts</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Connect your committee's checking account to reconcile transactions automatically
            </p>
          </div>
          <PlaidLinkButton
            committeeId={committeeId}
            onSuccess={() => window.location.reload()}
          />
        </div>

        {/* Connected accounts */}
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <BankAccountCard
                key={account.id}
                account={account}
                onSync={handleSync}
                onRemove={handleRemove}
              />
            ))}
          </div>
        ) : (
          <EmptyState committeeId={committeeId} />
        )}

        {/* Transactions */}
        {accounts.length > 0 && (
          <TransactionsTable
            transactions={transactions}
            contributions={contributions}
            expenditures={expenditures}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({ committeeId }: { committeeId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
        <Building2 className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">No bank account connected</h3>
      <p className="text-xs text-slate-500 max-w-xs mb-6">
        Connect your committee's checking account to automatically import transactions
        and reconcile them against your contributions and expenses.
      </p>
      <PlaidLinkButton committeeId={committeeId} onSuccess={() => window.location.reload()} />
      <p className="text-xs text-slate-400 mt-4">
        Uses Plaid — the same connection standard as Quickbooks and TurboTax
      </p>
    </div>
  )
}
