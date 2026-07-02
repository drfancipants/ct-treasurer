'use client'

import { useMemo, useState } from 'react'
import { DollarSign, Hash, Users, Sigma } from 'lucide-react'
import type { Contribution } from '@/lib/types'
import { donorKey } from '@/lib/limits'
import { formatCurrency, cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

type Preset = 'ytd' | 'prev-year' | 'custom'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ContributionsReport({ contributions }: { contributions: Contribution[] }) {
  const currentYear = new Date().getFullYear()
  const [preset, setPreset] = useState<Preset>('ytd')
  const [start, setStart] = useState(`${currentYear}-01-01`)
  const [end, setEnd] = useState(today())

  function applyPreset(p: Exclude<Preset, 'custom'>) {
    setPreset(p)
    if (p === 'ytd') {
      setStart(`${currentYear}-01-01`)
      setEnd(today())
    } else {
      setStart(`${currentYear - 1}-01-01`)
      setEnd(`${currentYear - 1}-12-31`)
    }
  }

  function setCustom(which: 'start' | 'end', value: string) {
    setPreset('custom')
    if (which === 'start') setStart(value)
    else setEnd(value)
  }

  const filtered = useMemo(
    () => contributions.filter((c) => c.date >= start && c.date <= end),
    [contributions, start, end]
  )

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

  const byMonth = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>()
    for (const c of filtered) {
      const key = c.date.slice(0, 7)
      const entry = map.get(key) ?? { count: 0, amount: 0 }
      entry.count += 1
      entry.amount += c.amount
      map.set(key, entry)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, label: format(parseISO(`${key}-01`), 'MMMM yyyy'), ...v }))
  }, [filtered])

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
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No contributions in this date range.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Month</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Contributions</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byMonth.map((m) => (
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
                <td className="px-4 py-3 text-sm font-semibold text-slate-700">Total</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-700 text-right tabular">{totals.count}</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right tabular">
                  {formatCurrency(totals.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
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
