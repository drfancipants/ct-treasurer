'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Reimbursement, Expenditure, CommitteeEvent } from '@/lib/types'
import { deleteReimbursement } from '@/actions/reimbursements'
import { formatCurrency, formatDate } from '@/lib/utils'
import ErrorBanner from '@/components/ui/ErrorBanner'
import FiledBadge from '@/components/ui/FiledBadge'
import ReimbursementDialog from './ReimbursementDialog'

interface Props {
  reimbursements: Reimbursement[]
  expenditures: Expenditure[]
  events: CommitteeEvent[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function ReimbursementsTable({ reimbursements: initial, expenditures, events, committeeId, committeeSlug, canEdit }: Props) {
  const [rows, setRows] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Reimbursement | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [error, setError] = useState('')

  function handleSave(row: Reimbursement) {
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
      await deleteReimbursement(id, committeeSlug)
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
          <h2 className="text-lg font-semibold text-slate-900">Worker reimbursements</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Out-of-pocket payments by workers or consultants · SEEC Form 20 Section T
            {rows.length > 0 && ` · ${rows.length} · ${formatCurrency(total)} total`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add reimbursement
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
        <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Worker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Purchased</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Vendor</th>
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
                  <p className="text-sm font-medium text-slate-900">{r.workerFirstName} {r.workerLastName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.expenditureId ? 'Repaid' : 'Not yet repaid'}</p>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <p className="text-sm text-slate-600">{r.description}</p>
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <p className="text-sm text-slate-600">{r.vendorName ?? '—'}</p>
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-medium text-rose-700 tabular">{formatCurrency(r.amount)}</td>
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
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-700">Total reimbursable</td>
                <td className="px-4 py-3 text-sm font-semibold text-rose-700 text-right tabular">{formatCurrency(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
        </div>

        {rows.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-slate-500">No worker reimbursements yet</p>
            {canEdit && (
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                Add the first one →
              </button>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <ReimbursementDialog open onClose={() => setShowAdd(false)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} expenditures={expenditures} events={events} />
      )}
      {editing && (
        <ReimbursementDialog key={editing.id} open onClose={() => setEditing(null)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} reimbursement={editing} expenditures={expenditures} events={events} />
      )}
    </>
  )
}
