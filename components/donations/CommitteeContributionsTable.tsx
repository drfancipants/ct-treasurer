'use client'

import { useState, useMemo } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import type { CommitteeContribution, CommitteeEvent, PaymentMethod } from '@/lib/types'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import { deleteCommitteeContribution } from '@/actions/committee-contributions'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import ErrorBanner from '@/components/ui/ErrorBanner'
import FiledBadge from '@/components/ui/FiledBadge'
import CommitteeContributionDialog from './CommitteeContributionDialog'

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CHECK: 'bg-slate-100 text-slate-700',
  CASH: 'bg-green-50 text-green-700',
  CREDIT_CARD: 'bg-blue-50 text-blue-700',
  DEBIT_CARD: 'bg-indigo-50 text-indigo-700',
  ONLINE: 'bg-purple-50 text-purple-700',
  OTHER: 'bg-slate-100 text-slate-600',
}

type SortKey = 'date' | 'committee' | 'amount'
type SortDir = 'asc' | 'desc'

interface Props {
  contributions: CommitteeContribution[]
  events: CommitteeEvent[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function CommitteeContributionsTable({ contributions: initial, events, committeeId, committeeSlug, canEdit }: Props) {
  const [rows, setRows] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CommitteeContribution | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'committee' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (search && !r.fromName.toLowerCase().includes(search.toLowerCase())) return false
        if (methodFilter !== 'ALL' && r.method !== methodFilter) return false
        if (dateFrom && r.date.slice(0, 10) < dateFrom) return false
        if (dateTo && r.date.slice(0, 10) > dateTo) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') {
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
        } else if (sortKey === 'amount') {
          cmp = a.amount - b.amount
        } else {
          cmp = a.fromName.toLowerCase().localeCompare(b.fromName.toLowerCase())
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [rows, search, methodFilter, dateFrom, dateTo, sortKey, sortDir])

  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0)

  function handleSave(row: CommitteeContribution) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = row
        return next
      }
      return [row, ...prev]
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
    const snapshot = rows
    setRows((prev) => prev.filter((r) => r.id !== id))
    setOpenMenu(null)
    try {
      await deleteCommitteeContribution(id, committeeSlug)
    } catch {
      setRows(snapshot)
      setError('Failed to delete. Please try again.')
    }
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Contributions from other committees</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            SEEC Form 20 Section C1
            {rows.length > 0 && ` · ${rows.length} · ${formatCurrency(total)} total`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add committee contribution
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by committee name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
        <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <SortableHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Committee" sortKey="committee" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Amount" sortKey="amount" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Filed</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id} className="table-row-hover group">
                <td className="px-4 py-3.5 text-sm text-slate-900 tabular whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="px-4 py-3.5">
                  <p className="text-sm font-medium text-slate-900">{r.fromName}</p>
                  {(r.city || r.treasurerName) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[r.treasurerName, [r.city, r.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-medium text-emerald-700 tabular">{formatCurrency(r.amount)}</td>
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  {r.method ? (
                    <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs font-medium', METHOD_COLORS[r.method])}>
                      {PAYMENT_METHOD_LABELS[r.method]}
                      {r.checkNumber && <span className="ml-1 opacity-60">#{r.checkNumber}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell"><FiledBadge filedAt={r.filedAt} /></td>
                <td className="px-4 py-3.5 relative">
                  {canEdit && (
                    <button
                      onClick={(e) => toggleMenu(r.id, e)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                  {openMenu === r.id && menuPos && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div
                        className="fixed z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                        style={{ top: menuPos.top, right: menuPos.right }}
                      >
                        <button onClick={() => { setEditing(r); setOpenMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-700">
                  Showing {filtered.length} of {rows.length}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">{formatCurrency(filteredTotal)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-slate-500">
              {rows.length === 0 ? 'No committee contributions yet' : 'No committee contributions match your filters'}
            </p>
            {canEdit && rows.length === 0 && (
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                Add the first one →
              </button>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <CommitteeContributionDialog open onClose={() => setShowAdd(false)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} events={events} />
      )}
      {editing && (
        <CommitteeContributionDialog key={editing.id} open onClose={() => setEditing(null)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} contribution={editing} events={events} />
      )}
    </>
  )
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = activeKey === sortKey
  return (
    <th className={cn('px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-slate-700 transition-colors',
          align === 'right' && 'flex-row-reverse',
          active && 'text-slate-700'
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-0" />
        )}
      </button>
    </th>
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
