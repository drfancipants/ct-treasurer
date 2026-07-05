'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, Search } from 'lucide-react'
import type { Payee } from '@/lib/types'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/types'
import { deletePayee } from '@/actions/payees'
import ErrorBanner from '@/components/ui/ErrorBanner'
import PayeeDialog from './PayeeDialog'

interface Props {
  payees: Payee[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function PayeesTable({ payees: initial, committeeId, committeeSlug, canEdit }: Props) {
  const [rows, setRows] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Payee | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const visible = rows.filter((p) => {
    if (!query) return true
    const q = query.toLowerCase()
    const hay = `${p.name} ${p.city ?? ''}`.toLowerCase()
    return hay.includes(q)
  })

  function handleSave(row: Payee) {
    setRows((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = row
        return next
      }
      return [...prev, row].sort((a, b) => a.name.localeCompare(b.name))
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
    setRows((prev) => prev.filter((p) => p.id !== id))
    setOpenMenu(null)
    try {
      await deletePayee(id, committeeSlug)
    } catch {
      setRows(snapshot)
      setError('Failed to delete. Please try again.')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payees</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Saved vendor defaults to speed up recording expenses
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add payee
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <div className="relative max-w-xs mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search payees…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
        <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Payee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Address</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Default category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Default purpose</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((p) => (
              <tr key={p.id} className="table-row-hover group">
                <td className="px-4 py-3.5">
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <p className="text-sm text-slate-600">
                    {[p.address1, [p.city, p.state].filter(Boolean).join(', '), p.zip].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                    {p.defaultCategory}
                  </span>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px] truncate" title={EXPENSE_CATEGORY_LABELS[p.defaultCategory]}>
                    {EXPENSE_CATEGORY_LABELS[p.defaultCategory]}
                  </p>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <p className="text-sm text-slate-600 max-w-xs truncate" title={p.defaultPurpose}>
                    {p.defaultPurpose || '—'}
                  </p>
                </td>
                <td className="px-4 py-3.5 relative">
                  {canEdit && (
                    <button
                      onClick={(e) => toggleMenu(p.id, e)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                  {openMenu === p.id && menuPos && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div
                        className="fixed z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                        style={{ top: menuPos.top, right: menuPos.right }}
                      >
                        <button onClick={() => { setEditing(p); setOpenMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
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
              {rows.length === 0 ? 'No payees yet' : 'No payees match your search'}
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
        <PayeeDialog open onClose={() => setShowAdd(false)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} />
      )}
      {editing && (
        <PayeeDialog key={editing.id} open onClose={() => setEditing(null)} onSave={handleSave} committeeId={committeeId} committeeSlug={committeeSlug} payee={editing} />
      )}
    </>
  )
}
