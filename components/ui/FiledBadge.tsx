import { FileCheck } from 'lucide-react'
import { formatDate } from '@/lib/utils'

/** Shows when an entry was included in a filed Form 20, or a dash if it wasn't. */
export default function FiledBadge({ filedAt }: { filedAt?: string }) {
  if (!filedAt) {
    return (
      <span className="text-xs text-slate-300" title="Not yet included in a filed Form 20">
        —
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-emerald-700 whitespace-nowrap"
      title={`Included in a Form 20 marked filed on ${formatDate(filedAt.slice(0, 10))}`}
    >
      <FileCheck className="w-3.5 h-3.5" />
      {formatDate(filedAt.slice(0, 10))}
    </span>
  )
}
