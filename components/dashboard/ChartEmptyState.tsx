import { BarChart3 } from 'lucide-react'

interface Props {
  message: string
  height: number
}

/** Placeholder shown inside a chart card when there is no data to plot yet */
export default function ChartEmptyState({ message, height }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-50/60"
      style={{ height }}
    >
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
        <BarChart3 className="w-4.5 h-4.5 text-slate-400" />
      </div>
      <p className="text-xs text-slate-400 max-w-[240px] text-center">{message}</p>
    </div>
  )
}
