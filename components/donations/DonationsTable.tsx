'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Upload,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { Contribution, PaymentMethod, ContributionSource, CommitteeEvent, RosterMember } from '@/lib/types'
import {
  getSeecStatus,
  PAYMENT_METHOD_LABELS,
  SOURCE_LABELS,
} from '@/lib/types'
import { formatCurrency, formatDate, formatAddress, cn } from '@/lib/utils'
import AddDonationDialog from './AddDonationDialog'
import { deleteContribution } from '@/actions/donations'
import AnedotImportDialog from './AnedotImportDialog'
import ErrorBanner from '@/components/ui/ErrorBanner'
import FiledBadge from '@/components/ui/FiledBadge'
import LimitAlerts from './LimitAlerts'

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CHECK: 'bg-slate-100 text-slate-700',
  CASH: 'bg-green-50 text-green-700',
  CREDIT_CARD: 'bg-blue-50 text-blue-700',
  DEBIT_CARD: 'bg-indigo-50 text-indigo-700',
  ONLINE: 'bg-purple-50 text-purple-700',
  OTHER: 'bg-slate-100 text-slate-600',
}

const SOURCE_COLORS: Record<ContributionSource, string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  ANEDOT: 'bg-orange-50 text-orange-700',
  BANK_IMPORT: 'bg-teal-50 text-teal-700',
}

type SortKey = 'date' | 'donor' | 'amount'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 25

interface Props {
  contributions: Contribution[]
  events: CommitteeEvent[]
  rosterMembers: RosterMember[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function DonationsTable({ contributions: initial, events, rosterMembers, committeeId, committeeSlug, canEdit }: Props) {
  const [contributions, setContributions] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Contribution | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL')
  const [sourceFilter, setSourceFilter] = useState<ContributionSource | 'ALL'>('ALL')
  const [seecFilter, setSeecFilter] = useState<'ALL' | 'compliant' | 'issues'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'donor' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    return contributions
      .filter((c) => {
        const name =
          `${c.contributor.firstName} ${c.contributor.lastName}`.toLowerCase()
        if (search && !name.includes(search.toLowerCase())) return false
        if (methodFilter !== 'ALL' && c.method !== methodFilter) return false
        if (sourceFilter !== 'ALL' && c.source !== sourceFilter) return false
        if (dateFrom && c.date.slice(0, 10) < dateFrom) return false
        if (dateTo && c.date.slice(0, 10) > dateTo) return false
        if (seecFilter !== 'ALL') {
          const status = getSeecStatus(c).status
          if (seecFilter === 'compliant' && status !== 'compliant') return false
          if (seecFilter === 'issues' && status === 'compliant') return false
        }
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') {
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
        } else if (sortKey === 'amount') {
          cmp = a.amount - b.amount
        } else {
          const nameA = `${a.contributor.firstName} ${a.contributor.lastName}`.toLowerCase()
          const nameB = `${b.contributor.firstName} ${b.contributor.lastName}`.toLowerCase()
          cmp = nameA.localeCompare(nameB)
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [contributions, search, methodFilter, sourceFilter, seecFilter, dateFrom, dateTo, sortKey, sortDir])

  const filteredTotal = filtered.reduce((s, c) => s + c.amount, 0)

  // Reset to page 1 whenever the filtered set changes (React's recommended
  // "adjust state during render" pattern — not a useEffect, so it doesn't
  // trigger the extra render a setState-in-effect would).
  const [prevFiltered, setPrevFiltered] = useState(filtered)
  if (filtered !== prevFiltered) {
    setPrevFiltered(filtered)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  function handleAdd(contribution: Contribution) {
    setContributions((prev) => {
      const idx = prev.findIndex((c) => c.id === contribution.id)
      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = contribution
        return updated
      }
      return [contribution, ...prev]
    })
    setShowAdd(false)
    setEditing(null)
  }

  function handleImport(imported: Contribution[]) {
    setContributions((prev) => [...imported, ...prev])
    // Don't close the dialog here — it advances to its confirmation step
    // and closes itself via onClose
  }

  async function handleDelete(id: string) {
    const snapshot = contributions
    setContributions((prev) => prev.filter((c) => c.id !== id))
    setOpenMenu(null)
    try {
      await deleteContribution(id, committeeSlug)
    } catch {
      setContributions(snapshot)
      setError('Failed to delete donation. Please try again.')
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Donations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {contributions.length} contributions · {formatCurrency(contributions.reduce((s, c) => s + c.amount, 0))} total
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Anedot CSV
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add donation
            </button>
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <LimitAlerts contributions={contributions} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by donor name…"
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

        <FilterSelect
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v as ContributionSource | 'ALL')}
          label="Source"
        >
          <option value="ALL">All sources</option>
          {(Object.keys(SOURCE_LABELS) as ContributionSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={seecFilter}
          onChange={(v) => setSeecFilter(v as 'ALL' | 'compliant' | 'issues')}
          label="SEEC status"
        >
          <option value="ALL">All SEEC status</option>
          <option value="compliant">Compliant only</option>
          <option value="issues">Has issues</option>
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <SortableHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Donor" sortKey="donor" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Amount" sortKey="amount" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                SEEC
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                Filed
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((contribution) => {
              const seec = getSeecStatus(contribution)
              const donor = contribution.contributor

              return (
                <tr key={contribution.id} className="table-row-hover group">
                  {/* Date */}
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-slate-900 tabular whitespace-nowrap">
                      {formatDate(contribution.date)}
                    </span>
                  </td>

                  {/* Donor */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-slate-900">
                      {donor.firstName} {donor.lastName}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                      {formatAddress(donor)}
                    </p>
                    {(donor.employer || donor.occupation) && (
                      <p className="text-xs text-slate-400 hidden md:block">
                        {[donor.occupation, donor.employer].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-semibold text-emerald-700 tabular">
                      {formatCurrency(contribution.amount)}
                    </span>
                    {!contribution.isItemized && (
                      <span className="block text-[10px] text-slate-400">non-itemized</span>
                    )}
                    {contribution.netAmount != null && contribution.netAmount !== contribution.amount && (
                      <span className="block text-[10px] text-slate-400" title="Amount deposited after processing fees">
                        {formatCurrency(contribution.netAmount)} net
                      </span>
                    )}
                  </td>

                  {/* Method */}
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                        METHOD_COLORS[contribution.method]
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[contribution.method]}
                      {contribution.checkNumber && (
                        <span className="ml-1 opacity-60">#{contribution.checkNumber}</span>
                      )}
                      {contribution.cardLast4 && (
                        <span className="ml-1 opacity-60">•{contribution.cardLast4}</span>
                      )}
                    </span>
                    {contribution.isRecurring && (
                      <span className="block text-[10px] text-slate-400 mt-0.5">recurring</span>
                    )}
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 rounded-md text-xs font-medium',
                          SOURCE_COLORS[contribution.source]
                        )}
                      >
                        {SOURCE_LABELS[contribution.source]}
                      </span>
                      {contribution.anedotId && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {contribution.anedotId.slice(-6)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* SEEC status */}
                  <td className="px-4 py-3.5">
                    <SeecBadge status={seec.status} issues={seec.issues} />
                  </td>

                  {/* Filed */}
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <FiledBadge filedAt={contribution.filedAt} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 relative">
                    {canEdit && (
                    <button
                      onClick={() => setOpenMenu(openMenu === contribution.id ? null : contribution.id)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Contribution actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    )}

                    {openMenu === contribution.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-2 top-full mt-1 z-20 w-44 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={() => { setEditing(contribution); setOpenMenu(null) }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {contribution.anedotId && (
                            <a
                              href={`https://app.anedot.com/donations/${contribution.anedotId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              onClick={() => setOpenMenu(null)}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View in Anedot
                            </a>
                          )}
                          <div className="border-t border-slate-100">
                            <button
                              onClick={() => handleDelete(contribution.id)}
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
              )
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500">
              {contributions.length === 0
                ? 'No donations yet'
                : 'No donations match your filters'}
            </p>
            {contributions.length === 0 && canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Record the first donation →
              </button>
            )}
          </div>
        )}

        {/* Footer total */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} contribution{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm font-semibold text-emerald-700 tabular">
              {formatCurrency(filteredTotal)}
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-slate-200">
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
          contribution — a persistent instance would keep its first-mount state */}
      {showAdd && (
        <AddDonationDialog
          open
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          existingContributions={contributions}
          events={events}
        />
      )}
      {editing && (
        <AddDonationDialog
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          onAdd={handleAdd}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          contribution={editing}
          existingContributions={contributions}
          events={events}
        />
      )}
      <AnedotImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        existingContributions={contributions}
        rosterMembers={rosterMembers}
        committeeId={committeeId}
        committeeSlug={committeeSlug}
      />
    </>
  )
}

function SeecBadge({
  status,
  issues,
}: {
  status: 'compliant' | 'missing_info' | 'incomplete'
  issues: string[]
}) {
  if (status === 'compliant') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        OK
      </span>
    )
  }
  if (status === 'missing_info') {
    return (
      <span
        title={issues.join('\n')}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200 cursor-help"
      >
        <AlertCircle className="w-3 h-3" />
        Review
      </span>
    )
  }
  return (
    <span
      title={issues.join('\n')}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200 cursor-help"
    >
      <XCircle className="w-3 h-3" />
      Incomplete
    </span>
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
