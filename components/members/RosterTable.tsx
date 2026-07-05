'use client'

import { useState, useMemo } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Upload, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { RosterMember } from '@/lib/types'
import { deleteRosterMember, setRosterMemberFlags, resetAllDues } from '@/actions/roster'
import { formatCurrency, cn } from '@/lib/utils'
import ErrorBanner from '@/components/ui/ErrorBanner'
import RosterMemberDialog from './RosterMemberDialog'
import RosterImportDialog from './RosterImportDialog'
import RosterMemberDonationsDialog from './RosterMemberDonationsDialog'

interface Props {
  members: RosterMember[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

type Filter = 'all' | 'active' | 'inactive' | 'dues_unpaid'

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['dues_unpaid', 'Dues unpaid'],
]

type SortKey = 'member' | 'address' | 'contributions'
type SortDir = 'asc' | 'desc'

export default function RosterTable({ members: initial, committeeId, committeeSlug, canEdit }: Props) {
  const [rows, setRows] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [editing, setEditing] = useState<RosterMember | null>(null)
  const [viewingDonations, setViewingDonations] = useState<RosterMember | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('member')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'contributions' ? 'desc' : 'asc')
    }
  }

  const activeCount = rows.filter((r) => r.isActive).length
  const duesPaidCount = rows.filter((r) => r.duesPaid || r.duesPaidViaAnedot).length

  const visible = useMemo(() => {
    return rows
      .filter((r) => {
        if (filter === 'active' && !r.isActive) return false
        if (filter === 'inactive' && r.isActive) return false
        if (filter === 'dues_unpaid' && (r.duesPaid || r.duesPaidViaAnedot)) return false
        if (query) {
          const q = query.toLowerCase()
          const hay = `${r.firstName} ${r.lastName} ${r.email ?? ''} ${r.phone ?? ''} ${r.city ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'contributions') {
          cmp = a.contributionTotal - b.contributionTotal
        } else if (sortKey === 'address') {
          cmp = (a.city ?? '').toLowerCase().localeCompare((b.city ?? '').toLowerCase())
        } else {
          cmp = (a.lastName + a.firstName).toLowerCase().localeCompare((b.lastName + b.firstName).toLowerCase())
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [rows, filter, query, sortKey, sortDir])

  function handleSave(row: RosterMember) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = row
        return next
      }
      return [...prev, row].sort((a, b) =>
        (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName))
    })
    setShowAdd(false)
    setEditing(null)
  }

  async function handleToggle(id: string, key: 'isActive' | 'duesPaid') {
    const snapshot = rows
    const current = rows.find((r) => r.id === id)
    if (!current) return
    const value = !current[key]
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
    try {
      await setRosterMemberFlags(id, { [key]: value }, committeeSlug)
    } catch {
      setRows(snapshot)
      setError('Failed to update. Please try again.')
    }
  }

  async function handleResetDues() {
    setResetting(true)
    try {
      await resetAllDues(committeeId, committeeSlug)
      setRows((prev) => prev.map((r) => ({ ...r, duesPaid: false })))
      setShowResetConfirm(false)
    } catch {
      setError('Failed to reset dues. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  async function handleDelete(id: string) {
    const snapshot = rows
    setRows((prev) => prev.filter((r) => r.id !== id))
    setOpenMenu(null)
    try {
      await deleteRosterMember(id, committeeSlug)
    } catch {
      setRows(snapshot)
      setError('Failed to delete. Please try again.')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Committee roster</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {rows.length} {rows.length === 1 ? 'member' : 'members'} · {activeCount} active · {duesPaidCount} paid dues
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={duesPaidCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Mark all members as dues unpaid for a new membership year"
            >
              <RotateCcw className="w-4 h-4" />
              Reset dues
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add member
            </button>
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <div className="flex items-center gap-3 mt-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, town…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                filter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <SortableHeader label="Member" sortKey="member" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader
                label="Address"
                sortKey="address"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                className="hidden lg:table-cell"
              />
              <SortableHeader
                label="Contributions"
                sortKey="contributions"
                activeKey={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                align="right"
                className="hidden md:table-cell"
              />
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Dues</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => (
              <tr key={r.id} className={cn('table-row-hover group', !r.isActive && 'opacity-60')}>
                <td className="px-4 py-3.5">
                  <p className="text-sm font-medium text-slate-900">{r.firstName} {r.lastName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[r.email, r.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <p className="text-sm text-slate-600">
                    {[r.address1, [r.city, r.state].filter(Boolean).join(', '), r.zip].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-right hidden md:table-cell">
                  {r.contributionTotal > 0 ? (
                    <button
                      onClick={() => setViewingDonations(r)}
                      className="text-right hover:opacity-75 transition-opacity"
                      title="View donation history"
                    >
                      <span className="text-sm font-medium text-emerald-700 tabular underline decoration-emerald-200 underline-offset-2">
                        {formatCurrency(r.contributionTotal)}
                      </span>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {r.contributionCount} {r.contributionCount === 1 ? 'gift' : 'gifts'}
                      </span>
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <FlagBadge
                    on={r.duesPaid || r.duesPaidViaAnedot}
                    onLabel={!r.duesPaid && r.duesPaidViaAnedot ? 'Paid · Anedot' : 'Paid'}
                    offLabel="Unpaid"
                    onColor="bg-emerald-50 text-emerald-700 ring-emerald-200"
                    offColor="bg-amber-50 text-amber-700 ring-amber-200"
                    canEdit={canEdit && !(r.duesPaidViaAnedot && !r.duesPaid)}
                    onClick={() => handleToggle(r.id, 'duesPaid')}
                    title={
                      r.duesPaidViaAnedot && !r.duesPaid
                        ? `Paid automatically — ${formatCurrency(r.anedotDuesTotal)} given to the dues campaign`
                        : undefined
                    }
                  />
                </td>
                <td className="px-4 py-3.5 text-center">
                  <FlagBadge
                    on={r.isActive}
                    onLabel="Active"
                    offLabel="Inactive"
                    onColor="bg-blue-50 text-blue-700 ring-blue-200"
                    offColor="bg-slate-100 text-slate-500 ring-slate-200"
                    canEdit={canEdit}
                    onClick={() => handleToggle(r.id, 'isActive')}
                  />
                </td>
                <td className="px-4 py-3.5 relative">
                  {canEdit && (
                    <button
                      onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                  {openMenu === r.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div className="absolute right-2 top-full mt-1 z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
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
        </table>
        </div>

        {visible.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-slate-500">
              {rows.length === 0 ? 'No committee members yet' : 'No members match the current filter'}
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
        <RosterMemberDialog open onClose={() => setShowAdd(false)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} />
      )}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <RotateCcw className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Reset dues for the new year?</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              This marks all {duesPaidCount} paid {duesPaidCount === 1 ? 'member' : 'members'} as
              dues unpaid. Do this at the start of each membership year, then mark members paid as
              their dues come in.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDues}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resetting ? 'Resetting…' : 'Reset all dues'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showImport && (
        // Stays open through its done step — onImported must not close it
        <RosterImportDialog
          open
          onClose={() => setShowImport(false)}
          onImported={(members) => setRows(members)}
          existingMembers={rows}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
        />
      )}
      {editing && (
        <RosterMemberDialog key={editing.id} open onClose={() => setEditing(null)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} member={editing} />
      )}
      {viewingDonations && (
        <RosterMemberDonationsDialog
          key={viewingDonations.id}
          open
          onClose={() => setViewingDonations(null)}
          member={viewingDonations}
          committeeSlug={committeeSlug}
        />
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
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <th className={cn('px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide', align === 'right' ? 'text-right' : 'text-left', className)}>
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

function FlagBadge({
  on, onLabel, offLabel, onColor, offColor, canEdit, onClick, title,
}: {
  on: boolean
  onLabel: string
  offLabel: string
  onColor: string
  offColor: string
  canEdit: boolean
  onClick: () => void
  title?: string
}) {
  const cls = cn(
    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1',
    on ? onColor : offColor,
    canEdit && 'cursor-pointer hover:opacity-80 transition-opacity'
  )
  if (!canEdit) return <span className={cls} title={title}>{on ? onLabel : offLabel}</span>
  return (
    <button onClick={onClick} className={cls} title={title ?? `Mark ${on ? offLabel.toLowerCase() : onLabel.toLowerCase()}`}>
      {on ? onLabel : offLabel}
    </button>
  )
}
