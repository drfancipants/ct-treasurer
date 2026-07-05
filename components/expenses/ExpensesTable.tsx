'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, BookmarkPlus } from 'lucide-react'
import type { Expenditure, ExpenseCategory, PaymentMethod, CommitteeEvent, Payee } from '@/lib/types'
import {
  EXPENSE_CATEGORY_LABELS,
  expenseCategoryColor,
  PAYMENT_METHOD_LABELS,
} from '@/lib/types'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import AddExpenseDialog from './AddExpenseDialog'
import AnedotFeesBanner from './AnedotFeesBanner'
import { deleteExpenditure, type UnrecordedFees } from '@/actions/expenses'
import { createPayee } from '@/actions/payees'
import ErrorBanner from '@/components/ui/ErrorBanner'
import FiledBadge from '@/components/ui/FiledBadge'

const PAGE_SIZE = 25

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CHECK: 'bg-slate-100 text-slate-700',
  CASH: 'bg-green-50 text-green-700',
  CREDIT_CARD: 'bg-blue-50 text-blue-700',
  DEBIT_CARD: 'bg-indigo-50 text-indigo-700',
  ONLINE: 'bg-purple-50 text-purple-700',
  OTHER: 'bg-slate-100 text-slate-600',
}

interface Props {
  expenditures: Expenditure[]
  events: CommitteeEvent[]
  payees?: Payee[]
  onPayeeCreated?: (payee: Payee) => void
  committeeId: string
  committeeSlug: string
  canEdit: boolean
  unrecordedFees?: UnrecordedFees
}

export default function ExpensesTable({ expenditures: initial, events, payees = [], onPayeeCreated, committeeId, committeeSlug, canEdit, unrecordedFees }: Props) {
  const [expenditures, setExpenditures] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Expenditure | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'ALL'>('ALL')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return expenditures
      .filter((e) => {
        if (
          search &&
          !e.payee.toLowerCase().includes(search.toLowerCase()) &&
          !e.purpose.toLowerCase().includes(search.toLowerCase())
        )
          return false
        if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false
        if (methodFilter !== 'ALL' && e.method !== methodFilter) return false
        if (dateFrom && e.date.slice(0, 10) < dateFrom) return false
        if (dateTo && e.date.slice(0, 10) > dateTo) return false
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenditures, search, categoryFilter, methodFilter, dateFrom, dateTo])

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0)

  // Reset to page 1 whenever the filter/search criteria change — keyed on
  // those values specifically, not on `filtered` itself, since editing or
  // adding an expense also produces a new `filtered` array reference (same
  // filters, different underlying data) and shouldn't bump the user back to
  // page 1. React's recommended "adjust state during render" pattern — not
  // a useEffect, so it doesn't trigger the extra render a setState-in-effect
  // would.
  const filterSignature = JSON.stringify([search, categoryFilter, methodFilter, dateFrom, dateTo])
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature)
  if (filterSignature !== prevFilterSignature) {
    setPrevFilterSignature(filterSignature)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  function handleAdd(expenditure: Expenditure) {
    setExpenditures((prev) => {
      const idx = prev.findIndex((e) => e.id === expenditure.id)
      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = expenditure
        return updated
      }
      return [expenditure, ...prev]
    })
    setShowAdd(false)
    setEditing(null)
  }

  // The dropdown uses position: fixed (not absolute) so it isn't clipped by
  // the table's horizontal-scroll wrapper — a container can't scroll on one
  // axis while leaving the other axis unclipped for absolutely-positioned
  // descendants, so this reads the trigger's on-screen position instead.
  function toggleMenu(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (openMenu === id) {
      setOpenMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpenMenu(id)
  }

  async function handleDelete(id: string) {
    const snapshot = expenditures
    setExpenditures((prev) => prev.filter((e) => e.id !== id))
    setOpenMenu(null)
    try {
      await deleteExpenditure(id, committeeSlug)
    } catch {
      setExpenditures(snapshot)
      setError('Failed to delete expense. Please try again.')
    }
  }

  /** Save an already-recorded expense's payee/category/purpose as a reusable Payee. */
  async function handleSaveAsPayee(expense: Expenditure) {
    setOpenMenu(null)
    try {
      const payee = await createPayee(
        committeeId,
        {
          name: expense.payee,
          address1: expense.payeeAddress1,
          city: expense.payeeCity,
          state: expense.payeeState,
          zip: expense.payeeZip,
          defaultCategory: expense.category,
          defaultPurpose: expense.purpose,
        },
        committeeSlug
      )
      onPayeeCreated?.(payee)
      setSuccessMessage(`Saved "${expense.payee}" as a payee`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payee')
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expenditures.length} {expenditures.length === 1 ? 'expenditure' : 'expenditures'} ·{' '}
            {formatCurrency(expenditures.reduce((s, e) => s + e.amount, 0))} total
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add expense
          </button>
        )}
      </div>

      {canEdit && unrecordedFees && (
        <div className="mt-4">
          <AnedotFeesBanner
            fees={unrecordedFees}
            committeeId={committeeId}
            committeeSlug={committeeSlug}
            onRecorded={(created) => setExpenditures((prev) => [...created, ...prev])}
          />
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {successMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search payee or purpose…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

        <FilterSelect
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v as ExpenseCategory | 'ALL')}
          label="Category"
        >
          <option value="ALL">All categories</option>
          {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
            <option key={c} value={c}>
              {c}: {EXPENSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={methodFilter}
          onChange={(v) => setMethodFilter(v as PaymentMethod | 'ALL')}
          label="Method"
        >
          <option value="ALL">All methods</option>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </FilterSelect>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
            className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
            className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 [&>th:first-child]:rounded-tl-xl [&>th:last-child]:rounded-tr-xl">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Payee &amp; purpose
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                Filed
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((expense) => (
              <tr key={expense.id} className="table-row-hover group">
                {/* Date */}
                <td className="px-4 py-3.5">
                  <span className="text-sm text-slate-900 tabular whitespace-nowrap">
                    {formatDate(expense.date)}
                  </span>
                </td>

                {/* Payee + purpose */}
                <td className="px-4 py-3.5">
                  <p className="text-sm font-medium text-slate-900">{expense.payee}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{expense.purpose}</p>
                </td>

                {/* Category */}
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                      expenseCategoryColor(expense.category)
                    )}
                  >
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                  </span>
                </td>

                {/* Amount */}
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-semibold text-rose-700 tabular">
                    ({formatCurrency(expense.amount)})
                  </span>
                </td>

                {/* Method */}
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                      METHOD_COLORS[expense.method]
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[expense.method]}
                    {expense.checkNumber && (
                      <span className="ml-1 opacity-60">#{expense.checkNumber}</span>
                    )}
                  </span>
                </td>

                {/* Filed */}
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <FiledBadge filedAt={expense.filedAt} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3.5 relative">
                  {canEdit && (
                  <button
                    onClick={(e) => toggleMenu(expense.id, e)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Expense actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  )}

                  {openMenu === expense.id && menuPos && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div
                        className="fixed z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                        style={{ top: menuPos.top, right: menuPos.right }}
                      >
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => { setEditing(expense); setOpenMenu(null) }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => handleSaveAsPayee(expense)}
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          Save as payee
                        </button>
                        <div className="border-t border-slate-100">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="py-16 text-center rounded-b-xl">
            <p className="text-sm text-slate-500">
              {expenditures.length === 0
                ? 'No expenses recorded yet'
                : 'No expenses match your filters'}
            </p>
            {expenditures.length === 0 && canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Record the first expense →
              </button>
            )}
          </div>
        )}

        {/* Footer total */}
        {filtered.length > 0 && (
          <div className={cn(
            'flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50',
            totalPages <= 1 && 'rounded-b-xl'
          )}>
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} expenditure{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm font-semibold text-rose-700 tabular">
              ({formatCurrency(filteredTotal)})
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-slate-200 rounded-b-xl">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="text-xs text-slate-500 tabular">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Mounted on demand so the form state initializes from the current
          expenditure — a persistent instance would keep its first-mount state */}
      {showAdd && (
        <AddExpenseDialog
          open
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          events={events}
          payees={payees}
          onPayeeCreated={onPayeeCreated}
        />
      )}
      {editing && (
        <AddExpenseDialog
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          onAdd={handleAdd}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          expenditure={editing}
          events={events}
          payees={payees}
          onPayeeCreated={onPayeeCreated}
        />
      )}
    </>
  )
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
    </div>
  )
}
