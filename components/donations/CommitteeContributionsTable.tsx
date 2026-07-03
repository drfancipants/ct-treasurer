'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { CommitteeContribution, CommitteeEvent } from '@/lib/types'
import { deleteCommitteeContribution } from '@/actions/committee-contributions'
import { formatCurrency, formatDate } from '@/lib/utils'
import ErrorBanner from '@/components/ui/ErrorBanner'
import FiledBadge from '@/components/ui/FiledBadge'
import CommitteeContributionDialog from './CommitteeContributionDialog'

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
  const [error, setError] = useState('')

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Committee</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Filed</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
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
                <td className="px-4 py-3.5 hidden lg:table-cell"><FiledBadge filedAt={r.filedAt} /></td>
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
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">{formatCurrency(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>

        {rows.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-slate-500">No committee contributions yet</p>
            {canEdit && (
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
