'use client'

import { useEffect, useState } from 'react'
import { X, HandCoins, Loader2 } from 'lucide-react'
import type { RosterMember } from '@/lib/types'
import { PAYMENT_METHOD_LABELS, SOURCE_LABELS } from '@/lib/types'
import { getRosterMemberDonations, type RosterDonation } from '@/actions/roster'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  member: RosterMember
  committeeSlug: string
}

export default function RosterMemberDonationsDialog({ open, onClose, member, committeeSlug }: Props) {
  const [donations, setDonations] = useState<RosterDonation[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    getRosterMemberDonations(member.id, committeeSlug)
      .then(setDonations)
      .catch(() => setError('Failed to load donations'))
  }, [open, member.id, committeeSlug])

  if (!open) return null

  const total = donations?.reduce((s, d) => s + d.amount, 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <HandCoins className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {member.firstName} {member.lastName}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {donations
                  ? `${donations.length} ${donations.length === 1 ? 'donation' : 'donations'} · ${formatCurrency(total)} total`
                  : 'Donation history'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-6 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          {!donations && !error && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {donations && donations.length === 0 && (
            <p className="px-6 py-16 text-center text-sm text-slate-500">
              No donations recorded for this member yet.
            </p>
          )}

          {donations && donations.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Method</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Source</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-sm text-slate-900 tabular whitespace-nowrap">{formatDate(d.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {PAYMENT_METHOD_LABELS[d.method]}
                      {d.memo && <span className="block text-xs text-slate-400 mt-0.5">{d.memo}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{SOURCE_LABELS[d.source]}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-emerald-700 tabular">{formatCurrency(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
