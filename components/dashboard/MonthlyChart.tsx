'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyData } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import ChartEmptyState from './ChartEmptyState'

interface Props {
  data: MonthlyData[]
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold text-slate-800 tabular">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      {payload.length === 2 && (
        <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
          <span className="text-slate-400">Net</span>
          <span
            className={`font-semibold tabular ${
              payload[0].value - payload[1].value >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(payload[0].value - payload[1].value)}
          </span>
        </div>
      )}
    </div>
  )
}

export default function MonthlyChart({ data }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Monthly activity</h3>
        <p className="text-xs text-slate-500 mt-0.5">Contributions and expenses by month</p>
      </div>
      {data.length === 0 ? (
        <ChartEmptyState
          height={248}
          message="No activity yet — monthly totals appear once you record a donation or expense"
        />
      ) : (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={4} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          />
          <Bar dataKey="raised" name="Raised" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="spent" name="Spent" fill="#e11d48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
