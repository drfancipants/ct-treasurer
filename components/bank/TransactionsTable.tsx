'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, AlertCircle, MinusCircle, Search } from 'lucide-react'
import type { BankTransaction, Contribution, Expenditure, TransactionMatchType } from '@/lib/types'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import ReconcileDialog from './ReconcileDialog'

type Tab = 'ALL' | 'UNMATCHED' | 'MATCHED' | 'IGNORED'

const STATUS_CONFIG: Record<
  TransactionMatchType,
  { icon: React.ComponentType<{ className?: string }>; label: string; className: string }
> = {
  CONTRIBUTION: {
    icon: CheckCircle2,
    label: 'Contribution',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  EXPENDITURE: {
    icon: CheckCircle2,
    label: 'Expense',
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  UNMATCHED: {
    icon: AlertCircle,
    label: 'Unmatched',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  IGNORED: {
    icon: MinusCircle,
    label: 'No match',
    className: 'bg-slate-100 text-slate-500 ring-slate-200',
  },
}

interface Props {
  transactions: BankTransaction[]
  contributions: Contribution[]
  expenditures: Expenditure[]
}

export default function TransactionsTable({ transactions: initial, contributions, expenditures }: Props) {
  const [transactions, setTransactions] = useState(initial)
  const [tab, setTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const [reconciling, setReconciling] = useState<BankTransaction | null>(null)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: transactions.length },
    {
      key: 'UNMATCHED',
      label: 'Needs review',
      count: transactions.filter((t) => t.matchType === 'UNMATCHED').length,
    },
    {
      key: 'MATCHED',
      label: 'Matched',
      count: transactions.filter(
        (t) => t.matchType === 'CONTRIBUTION' || t.matchType === 'EXPENDITURE'
      ).length,
    },
    {
      key: 'IGNORED',
      label: 'Ignored',
      count: transactions.filter((t) => t.matchType === 'IGNORED').length,
    },
  ]

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (search) {
          const q = search.toLowerCase()
          if (
            !t.description.toLowerCase().includes(q) &&
            !t.merchantName?.toLowerCase().includes(q)
          )
            return false
        }
        if (tab === 'UNMATCHED') return t.matchType === 'UNMATCHED'
        if (tab === 'MATCHED')
          return t.matchType === 'CONTRIBUTION' || t.matchType === 'EXPENDITURE'
        if (tab === 'IGNORED') return t.matchType === 'IGNORED'
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, tab, search])

  function handleReconcile(
    transactionId: string,
    matchType: 'CONTRIBUTION' | 'EXPENDITURE' | 'IGNORED',
    matchedId?: string
  ) {
    // TODO: persist via server action
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              matchType,
              isReconciled: true,
              matchedContributionId:
                matchType === 'CONTRIBUTION' ? matchedId : undefined,
              matchedExpenditureId:
                matchType === 'EXPENDITURE' ? matchedId : undefined,
            }
          : t
      )
    )
  }

  const unmatchedCount = transactions.filter((t) => t.matchType === 'UNMATCHED').length

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
          {unmatchedCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">
              {unmatchedCount} transaction{unmatchedCount !== 1 ? 's' : ''} need{unmatchedCount === 1 ? 's' : ''} reconciliation
            </p>
          )}
        </div>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {t.label}
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-medium',
                tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500',
                t.key === 'UNMATCHED' && t.count > 0 && tab !== 'UNMATCHED'
                  ? 'bg-amber-100 text-amber-700'
                  : ''
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((tx) => {
              const status = STATUS_CONFIG[tx.matchType]
              const StatusIcon = status.icon
              const isDeposit = tx.amount > 0

              return (
                <tr key={tx.id} className="table-row-hover">
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-slate-700 tabular whitespace-nowrap">
                      {formatDate(tx.date)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                    {tx.merchantName && tx.merchantName !== tx.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{tx.merchantName}</p>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={cn(
                        'text-sm font-semibold tabular',
                        isDeposit ? 'text-emerald-700' : 'text-rose-700'
                      )}
                    >
                      {isDeposit ? '+' : ''}{formatCurrency(tx.amount)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {tx.category && (
                      <span className="text-xs text-slate-500">{tx.category}</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1',
                        status.className
                      )}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    {tx.matchType === 'UNMATCHED' && (
                      <button
                        onClick={() => setReconciling(tx)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        Reconcile
                      </button>
                    )}
                    {(tx.matchType === 'CONTRIBUTION' || tx.matchType === 'EXPENDITURE') && (
                      <button
                        onClick={() => setReconciling(tx)}
                        className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:bg-slate-100 transition-colors"
                      >
                        Change
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500">
              {transactions.length === 0
                ? 'No transactions yet — sync your account to pull them in'
                : 'No transactions match your filters'}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">
                Deposits{' '}
                <span className="font-semibold text-emerald-700 tabular">
                  +{formatCurrency(filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
                </span>
              </span>
              <span className="text-xs text-slate-500">
                Withdrawals{' '}
                <span className="font-semibold text-rose-700 tabular">
                  {formatCurrency(filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      <ReconcileDialog
        transaction={reconciling}
        contributions={contributions}
        expenditures={expenditures}
        onClose={() => setReconciling(null)}
        onReconcile={handleReconcile}
      />
    </>
  )
}
