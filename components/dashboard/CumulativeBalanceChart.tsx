'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CumulativePoint } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import ChartEmptyState from './ChartEmptyState'

interface Props {
  data: CumulativePoint[]
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const raised = payload.find((p) => p.name === 'Total raised')?.value ?? 0
  const spent = payload.find((p) => p.name === 'Total spent')?.value ?? 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
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
      <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
        <span className="text-slate-400">Balance</span>
        <span
          className={`font-semibold tabular ${
            raised - spent >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatCurrency(raised - spent)}
        </span>
      </div>
    </div>
  )
}

export default function CumulativeBalanceChart({ data }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Cumulative balance</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Running total of raised vs. spent — the gap is your current balance
        </p>
      </div>
      {data.length === 0 ? (
        <ChartEmptyState
          height={228}
          message="Your running balance will chart here as donations and expenses come in"
        />
      ) : (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gradRaised" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e11d48" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Area
            type="monotone"
            dataKey="totalRaised"
            name="Total raised"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#gradRaised)"
            dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="totalSpent"
            name="Total spent"
            stroke="#e11d48"
            strokeWidth={2}
            fill="url(#gradSpent)"
            dot={{ r: 3, fill: '#e11d48', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
