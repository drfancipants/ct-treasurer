'use client'

import { useMemo, useState } from 'react'
import {
  DollarSign,
  Hash,
  Users,
  Sigma,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { Contribution, CommitteeEvent } from '@/lib/types'
import { donorKey } from '@/lib/limits'
import { formatCurrency, cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

type Preset = 'ytd' | 'prev-year' | 'custom'
type Tab = 'overview' | 'donors' | 'events'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 10

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface MonthRow {
  key: string
  label: string
  count: number
  amount: number
}

interface DonorRow {
  key: string
  name: string
  email?: string
  count: number
  amount: number
}

export default function ContributionsReport({ contributions, events }: { contributions: Contribution[]; events: CommitteeEvent[] }) {
  const currentYear = new Date().getFullYear()
  const [tab, setTab] = useState<Tab>('overview')
  const [preset, setPreset] = useState<Preset>('ytd')
  const [start, setStart] = useState(`${currentYear}-01-01`)
  const [end, setEnd] = useState(today())

  // Sorting + pagination, per table
  const [monthSort, setMonthSort] = useState<{ key: keyof MonthRow; dir: SortDir }>({ key: 'key', dir: 'asc' })
  const [donorSort, setDonorSort] = useState<{ key: keyof DonorRow; dir: SortDir }>({ key: 'amount', dir: 'desc' })
  const [monthPage, setMonthPage] = useState(0)
  const [donorPage, setDonorPage] = useState(0)

  function resetPages() {
    setMonthPage(0)
    setDonorPage(0)
  }

  function applyPreset(p: Exclude<Preset, 'custom'>) {
    setPreset(p)
    if (p === 'ytd') {
      setStart(`${currentYear}-01-01`)
      setEnd(today())
    } else {
      setStart(`${currentYear - 1}-01-01`)
      setEnd(`${currentYear - 1}-12-31`)
    }
    resetPages()
  }

  function setCustom(which: 'start' | 'end', value: string) {
    setPreset('custom')
    if (which === 'start') setStart(value)
    else setEnd(value)
    resetPages()
  }

  const filtered = useMemo(
    () => contributions.filter((c) => c.date >= start && c.date <= end),
    [contributions, start, end]
  )

  const filteredEvents = useMemo(
    () => events.filter((e) => e.date >= start && e.date <= end).sort((a, b) => a.date.localeCompare(b.date)),
    [events, start, end]
  )
  const eventReceipts = filteredEvents.reduce((s, e) => s + e.foodReceipts + e.tagSaleReceipts, 0)

  const totals = useMemo(() => {
    const donors = new Set(filtered.map((c) => donorKey(c.contributor)))
    const total = filtered.reduce((s, c) => s + c.amount, 0)
    return {
      total,
      count: filtered.length,
      donors: donors.size,
      average: filtered.length > 0 ? total / filtered.length : 0,
    }
  }, [filtered])

  const byMonth = useMemo<MonthRow[]>(() => {
    const map = new Map<string, { count: number; amount: number }>()
    for (const c of filtered) {
      const key = c.date.slice(0, 7)
      const entry = map.get(key) ?? { count: 0, amount: 0 }
      entry.count += 1
      entry.amount += c.amount
      map.set(key, entry)
    }
    return [...map.entries()].map(([key, v]) => ({
      key,
      label: format(parseISO(`${key}-01`), 'MMMM yyyy'),
      ...v,
    }))
  }, [filtered])

  const byDonor = useMemo<DonorRow[]>(() => {
    const map = new Map<string, DonorRow>()
    for (const c of filtered) {
      const key = donorKey(c.contributor)
      const entry = map.get(key) ?? {
        key,
        name: `${c.contributor.firstName} ${c.contributor.lastName}`.trim(),
        email: c.contributor.email,
        count: 0,
        amount: 0,
      }
      entry.count += 1
      entry.amount += c.amount
      if (!entry.email && c.contributor.email) entry.email = c.contributor.email
      map.set(key, entry)
    }
    return [...map.values()]
  }, [filtered])

  const sortedMonths = useMemo(
    () => sortRows(byMonth, monthSort.key, monthSort.dir),
    [byMonth, monthSort]
  )
  const sortedDonors = useMemo(
    () => sortRows(byDonor, donorSort.key, donorSort.dir),
    [byDonor, donorSort]
  )

  const pagedMonths = paginate(sortedMonths, monthPage)
  const pagedDonors = paginate(sortedDonors, donorPage)

  function toggleMonthSort(key: keyof MonthRow) {
    setMonthSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
    setMonthPage(0)
  }
  function toggleDonorSort(key: keyof DonorRow) {
    setDonorSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
    setDonorPage(0)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setCustom('start', e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setCustom('end', e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <PresetButton active={preset === 'ytd'} onClick={() => applyPreset('ytd')}>
              Year to date
            </PresetButton>
            <PresetButton active={preset === 'prev-year'} onClick={() => applyPreset('prev-year')}>
              Previous year ({currentYear - 1})
            </PresetButton>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([['overview', 'Overview'], ['donors', 'By donor'], ['events', 'Events']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon={DollarSign} label="Total contributions" value={formatCurrency(totals.total)} accent="text-emerald-700" />
            <StatTile icon={Hash} label="Contributions" value={String(totals.count)} />
            <StatTile icon={Users} label="Unique donors" value={String(totals.donors)} />
            <StatTile icon={Sigma} label="Average gift" value={formatCurrency(totals.average)} />
          </div>

          {/* Monthly breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">By month</p>
            </div>
            {byMonth.length === 0 ? (
              <EmptyRange />
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <SortHeader label="Month" sortKey="key" sort={monthSort} onSort={toggleMonthSort} />
                      <SortHeader label="Contributions" sortKey="count" sort={monthSort} onSort={toggleMonthSort} align="right" />
                      <SortHeader label="Amount" sortKey="amount" sort={monthSort} onSort={toggleMonthSort} align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedMonths.rows.map((m) => (
                      <tr key={m.key} className="table-row-hover">
                        <td className="px-4 py-3 text-sm text-slate-900">{m.label}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right tabular">{m.count}</td>
                        <td className="px-4 py-3 text-sm font-medium text-emerald-700 text-right tabular">
                          {formatCurrency(m.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">Total ({byMonth.length} months)</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700 text-right tabular">{totals.count}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">
                        {formatCurrency(totals.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <Pager page={monthPage} total={sortedMonths.length} onPage={setMonthPage} />
              </>
            )}
          </div>
        </>
      )}

      {tab === 'events' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fundraising events</p>
            <p className="text-xs text-slate-400">{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</p>
          </div>
          {filteredEvents.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No events in this date range.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-10">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Event</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Receipts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((e) => (
                  <tr key={e.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">{e.letter}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 tabular whitespace-nowrap">{format(parseISO(e.date), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{e.description}</td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-700 text-right tabular">
                      {e.foodReceipts + e.tagSaleReceipts > 0 ? formatCurrency(e.foodReceipts + e.tagSaleReceipts) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-700">Total receipts</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">{formatCurrency(eventReceipts)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {tab === 'donors' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals by donor</p>
            <p className="text-xs text-slate-400">
              {byDonor.length} donor{byDonor.length !== 1 ? 's' : ''}
            </p>
          </div>
          {byDonor.length === 0 ? (
            <EmptyRange />
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <SortHeader label="Donor" sortKey="name" sort={donorSort} onSort={toggleDonorSort} />
                    <SortHeader label="Contributions" sortKey="count" sort={donorSort} onSort={toggleDonorSort} align="right" />
                    <SortHeader label="Total" sortKey="amount" sort={donorSort} onSort={toggleDonorSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedDonors.rows.map((d) => (
                    <tr key={d.key} className="table-row-hover">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{d.name}</p>
                        {d.email && <p className="text-xs text-slate-400">{d.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right tabular">{d.count}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-700 text-right tabular">
                        {formatCurrency(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 text-right tabular">{totals.count}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">
                      {formatCurrency(totals.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <Pager page={donorPage} total={sortedDonors.length} onPage={setDonorPage} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sorting & pagination helpers ─────────────────────────────────────────────

function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
    return String(av ?? '').localeCompare(String(bv ?? '')) * sign
  })
}

function paginate<T>(rows: T[], page: number): { rows: T[]; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const p = Math.min(page, pages - 1)
  return { rows: rows.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE), pages }
}

function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string
  sortKey: K
  sort: { key: K; dir: SortDir }
  onSort: (key: K) => void
  align?: 'right'
}) {
  const active = sort.key === sortKey
  const Icon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide',
        align === 'right' ? 'text-right' : 'text-left'
      )}
    >
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800 transition-colors',
          active && 'text-slate-800',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {label}
        <Icon className={cn('w-3 h-3', active ? 'text-slate-600' : 'text-slate-300')} />
      </button>
    </th>
  )
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null
  const from = page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-slate-500 px-2 tabular">
          {page + 1} / {pages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function EmptyRange() {
  return (
    <p className="px-4 py-10 text-center text-sm text-slate-400">
      No contributions in this date range.
    </p>
  )
}

function PresetButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors border',
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={cn('text-2xl font-semibold tabular tracking-tight', accent ?? 'text-slate-900')}>
        {value}
      </p>
    </div>
  )
}
