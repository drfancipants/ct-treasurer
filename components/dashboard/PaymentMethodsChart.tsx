'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { MethodData } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import ChartEmptyState from './ChartEmptyState'

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#64748b']

interface Props {
  data: MethodData[]
  total: number
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: MethodData }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <p className="text-slate-500 mt-1">
        {formatCurrency(d.value)} · {d.payload.count}{' '}
        {d.payload.count === 1 ? 'contribution' : 'contributions'}
      </p>
    </div>
  )
}

export default function PaymentMethodsChart({ data, total }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">By payment method</h3>
        <p className="text-xs text-slate-500 mt-0.5">How donors are giving</p>
      </div>

      {data.length === 0 ? (
        <ChartEmptyState
          height={160}
          message="The payment method mix appears after your first donation"
        />
      ) : (
      <>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {data.map((entry, i) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
          return (
            <div key={entry.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {entry.name}
              </span>
              <span className="text-slate-500 tabular">
                {pct}% · {formatCurrency(entry.value)}
              </span>
            </div>
          )
        })}
      </div>
      </>
      )}
    </div>
  )
}
