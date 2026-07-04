'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import type { BankAccount, BankTransaction, Contribution, Expenditure, Payee } from '@/lib/types'
import BankAccountCard from './BankAccountCard'
import PlaidLinkButton from './PlaidLinkButton'
import TransactionsTable from './TransactionsTable'
import { removeBankAccount } from '@/actions/bank'
import ErrorBanner from '@/components/ui/ErrorBanner'

interface Props {
  committeeId: string
  committeeSlug: string
  accounts: BankAccount[]
  transactions: BankTransaction[]
  contributions: Contribution[]
  expenditures: Expenditure[]
  payees: Payee[]
  canEdit: boolean
}

export default function BankPageClient({
  committeeId,
  committeeSlug,
  accounts,
  transactions,
  contributions,
  expenditures,
  payees: initialPayees,
  canEdit,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [payees, setPayees] = useState(initialPayees)

  function handlePayeeCreated(payee: Payee) {
    setPayees((prev) => [...prev, payee].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleSync(accountId: string) {
    setError('')
    const res = await fetch('/api/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccountId: accountId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Sync failed. Please try again.')
      return
    }
    router.refresh()
  }

  async function handleRemove(accountId: string) {
    setError('')
    try {
      await removeBankAccount(accountId, committeeSlug)
      router.refresh()
    } catch {
      setError('Failed to remove account. Please try again.')
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Bank accounts</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Connect your committee&apos;s checking account to reconcile transactions automatically
            </p>
          </div>
          {canEdit && <PlaidLinkButton committeeId={committeeId} onSuccess={() => router.refresh()} />}
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
                canEdit={canEdit}
              />
            ))}
          </div>
        ) : (
          <EmptyState committeeId={committeeId} onSuccess={() => router.refresh()} canEdit={canEdit} />
        )}

        {/* Transactions */}
        {accounts.length > 0 && (
          <TransactionsTable
            transactions={transactions}
            contributions={contributions}
            expenditures={expenditures}
            payees={payees}
            onPayeeCreated={handlePayeeCreated}
            committeeId={committeeId}
            committeeSlug={committeeSlug}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({
  committeeId,
  onSuccess,
  canEdit,
}: {
  committeeId: string
  onSuccess: () => void
  canEdit: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
        <Building2 className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">No bank account connected</h3>
      <p className="text-xs text-slate-500 max-w-xs mb-6">
        Connect your committee&apos;s checking account to automatically import transactions
        and reconcile them against your contributions and expenses.
      </p>
      {canEdit && <PlaidLinkButton committeeId={committeeId} onSuccess={onSuccess} />}
      <p className="text-xs text-slate-400 mt-4">
        Uses Plaid — the same connection standard as Quickbooks and TurboTax
      </p>
    </div>
  )
}
