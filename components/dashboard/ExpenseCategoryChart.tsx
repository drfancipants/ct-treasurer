'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { CategoryData } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#e11d48', '#64748b']

interface Props {
  data: CategoryData[]
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: { value: number; payload: CategoryData }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800">{d.payload.name}</p>
      <p className="text-slate-500 mt-1">
        {formatCurrency(d.value)} · {d.payload.count}{' '}
        {d.payload.count === 1 ? 'item' : 'items'}
      </p>
    </div>
  )
}

export default function ExpenseCategoryChart({ data }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Expenses by category</h3>
        <p className="text-xs text-slate-500 mt-0.5">Where the money is going</p>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 36 + 20, 160)}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
