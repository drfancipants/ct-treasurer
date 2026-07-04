'use client'

import { useState } from 'react'
import { X, CheckCircle2, ArrowRight, Ban, PlusCircle } from 'lucide-react'
import type { BankTransaction, Contribution, Expenditure, Payee } from '@/lib/types'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import AddExpenseDialog from '@/components/expenses/AddExpenseDialog'

interface Match {
  type: 'CONTRIBUTION' | 'EXPENDITURE'
  id: string
  label: string
  amount: number
  date: string
  score: 'exact' | 'close' | 'partial'
}

interface Props {
  transaction: BankTransaction | null
  contributions: Contribution[]
  expenditures: Expenditure[]
  payees?: Payee[]
  onPayeeCreated?: (payee: Payee) => void
  committeeId: string
  committeeSlug: string
  onClose: () => void
  onReconcile: (
    transactionId: string,
    matchType: 'CONTRIBUTION' | 'EXPENDITURE' | 'IGNORED',
    matchedId?: string
  ) => void
}

function scoreMatch(txAmount: number, txDate: string, amount: number, date: string): 'exact' | 'close' | 'partial' | null {
  const amountDiff = Math.abs(Math.abs(txAmount) - amount)
  const daysDiff = Math.abs(
    (new Date(txDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (amountDiff > 10) return null
  if (amountDiff === 0 && daysDiff <= 2) return 'exact'
  if (amountDiff <= 1 && daysDiff <= 5) return 'close'
  if (amountDiff <= 5 && daysDiff <= 10) return 'partial'
  return null
}

export default function ReconcileDialog({
  transaction,
  contributions,
  expenditures,
  payees = [],
  onPayeeCreated,
  committeeId,
  committeeSlug,
  onClose,
  onReconcile,
}: Props) {
  const [selected, setSelected] = useState<Match | null>(null)
  const [view, setView] = useState<'match' | 'create'>('match')

  if (!transaction) return null

  if (view === 'create') {
    return (
      <AddExpenseDialog
        open
        onClose={() => setView('match')}
        onAdd={(expenditure) => {
          onReconcile(transaction.id, 'EXPENDITURE', expenditure.id)
          onClose()
        }}
        committeeId={committeeId}
        committeeSlug={committeeSlug}
        payees={payees}
        onPayeeCreated={onPayeeCreated}
        initialValues={{
          amount: Math.abs(transaction.amount),
          date: transaction.date,
          payee: transaction.merchantName || transaction.description,
          method: 'DEBIT_CARD',
        }}
      />
    )
  }

  const isDeposit = transaction.amount > 0

  // Build suggested matches
  const suggestions: Match[] = []

  if (isDeposit) {
    for (const c of contributions) {
      if (c.id === transaction.matchedContributionId) continue
      const score = scoreMatch(transaction.amount, transaction.date, c.amount, c.date)
      if (score) {
        suggestions.push({
          type: 'CONTRIBUTION',
          id: c.id,
          label: `${c.contributor.firstName} ${c.contributor.lastName}`,
          amount: c.amount,
          date: c.date,
          score,
        })
      }
    }
  } else {
    for (const e of expenditures) {
      if (e.id === transaction.matchedExpenditureId) continue
      const score = scoreMatch(transaction.amount, transaction.date, e.amount, e.date)
      if (score) {
        suggestions.push({
          type: 'EXPENDITURE',
          id: e.id,
          label: e.payee,
          amount: e.amount,
          date: e.date,
          score,
        })
      }
    }
  }

  const scoreOrder = { exact: 0, close: 1, partial: 2 }
  suggestions.sort((a, b) => scoreOrder[a.score] - scoreOrder[b.score])

  function handleConfirm() {
    if (!selected) return
    onReconcile(transaction!.id, selected.type, selected.id)
    onClose()
  }

  function handleIgnore() {
    onReconcile(transaction!.id, 'IGNORED')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Reconcile transaction</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Match this bank entry to a recorded {isDeposit ? 'contribution' : 'expense'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Transaction summary */}
          <div className="flex items-start justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-900">{transaction.description}</p>
              {transaction.merchantName && transaction.merchantName !== transaction.description && (
                <p className="text-xs text-slate-500 mt-0.5">{transaction.merchantName}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">{formatDate(transaction.date)}</p>
            </div>
            <span className={cn('text-base font-semibold tabular', isDeposit ? 'text-emerald-700' : 'text-rose-700')}>
              {isDeposit ? '+' : ''}{formatCurrency(transaction.amount)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <ArrowRight className="w-4 h-4" />
            <p className="text-xs">Match to</p>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((match) => (
                <button
                  key={match.id}
                  onClick={() => setSelected(selected?.id === match.id ? null : match)}
                  className={cn(
                    'w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-colors',
                    selected?.id === match.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full border-2 shrink-0 transition-colors',
                        selected?.id === match.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                      )}
                    >
                      {selected?.id === match.id && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{match.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500">{formatDate(match.date)}</p>
                        <ScoreBadge score={match.score} />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 tabular">
                    {formatCurrency(match.amount)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">No close matches found.</p>
              <p className="text-xs text-slate-400 mt-1">
                {isDeposit
                  ? 'The amount or date may differ significantly from your contribution records.'
                  : 'Create a new expense below or mark as no match.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={handleIgnore}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
            No match
          </button>
          {!isDeposit && (
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create expense
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm match
          </button>
        </div>
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: 'exact' | 'close' | 'partial' }) {
  if (score === 'exact')
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
        Exact match
      </span>
    )
  if (score === 'close')
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
        Close match
      </span>
    )
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
      Partial match
    </span>
  )
}
