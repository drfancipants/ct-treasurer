'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, MapPin } from 'lucide-react'
import type { CommitteeEvent } from '@/lib/types'
import { deleteEvent } from '@/actions/events'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import ErrorBanner from '@/components/ui/ErrorBanner'
import EventDialog from './EventDialog'

interface Props {
  events: CommitteeEvent[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function EventsList({ events: initial, committeeId, committeeSlug, canEdit }: Props) {
  const [events, setEvents] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CommitteeEvent | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleSave(event: CommitteeEvent) {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === event.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = event
        return next
      }
      return [...prev, event].sort((a, b) => a.date.localeCompare(b.date))
    })
    setShowAdd(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    const snapshot = events
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setOpenMenu(null)
    try {
      await deleteEvent(id, committeeSlug)
    } catch {
      setEvents(snapshot)
      setError('Failed to delete event. Please try again.')
    }
  }

  const totalReceipts = events.reduce((s, e) => s + e.foodReceipts + e.tagSaleReceipts, 0)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Events</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Fundraising events for SEEC Form 20 (Section L1)
            {events.length > 0 && ` · ${events.length} event${events.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add event
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-10">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Event</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Receipts</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((e) => (
              <tr key={e.id} className="table-row-hover group">
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                    {e.letter}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-900 tabular whitespace-nowrap">{formatDate(e.date)}</td>
                <td className="px-4 py-3.5">
                  <p className="text-sm font-medium text-slate-900">{e.description}</p>
                  {(e.city || e.street) && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[e.street, e.city, e.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {e.isFundraiser && <Tag>Fundraiser</Tag>}
                    {e.wasTagSale && <Tag>Tag sale</Tag>}
                    {e.hadProgramBook && <Tag>Program book</Tag>}
                    {e.soldFoodAtFair && <Tag>Food at fair</Tag>}
                    {e.isPersonalResidence && <Tag>Home</Tag>}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-medium text-emerald-700 tabular">
                  {e.foodReceipts + e.tagSaleReceipts > 0
                    ? formatCurrency(e.foodReceipts + e.tagSaleReceipts)
                    : '—'}
                </td>
                <td className="px-4 py-3.5 relative">
                  {canEdit && (
                    <button
                      onClick={() => setOpenMenu(openMenu === e.id ? null : e.id)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Event actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                  {openMenu === e.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div className="absolute right-2 top-full mt-1 z-20 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <button
                          onClick={() => { setEditing(e); setOpenMenu(null) }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {events.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-700">Total receipts</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">
                  {formatCurrency(totalReceipts)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {events.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-slate-500">No events recorded yet</p>
            {canEdit && (
              <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                Add your first event →
              </button>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <EventDialog
          open
          onClose={() => setShowAdd(false)}
          onSave={handleSave}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          usedLetters={events.map((e) => e.letter)}
        />
      )}
      {editing && (
        <EventDialog
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          onSave={handleSave}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          event={editing}
          usedLetters={events.map((e) => e.letter)}
        />
      )}
    </>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600')}>
      {children}
    </span>
  )
}
