'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Building2, Plus } from 'lucide-react'
import type { Committee } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  committees: Committee[]
  activeCommittee: Committee
}

export default function CommitteeSwitcher({ committees, activeCommittee }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function select(committee: Committee) {
    setOpen(false)
    router.push(`/app/${committee.slug}/donations`)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-white/8 transition-colors text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="w-7 h-7 rounded-md bg-blue-900 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-blue-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-white font-medium truncate leading-tight">
            {activeCommittee.name}
          </p>
          {activeCommittee.city && (
            <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
              {activeCommittee.city} · {activeCommittee.electionYear}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-500 transition-transform shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 z-20 bg-[#1a2f52] border border-white/15 rounded-lg shadow-xl overflow-hidden"
          >
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Your committees
            </p>
            {committees.map((c) => (
              <button
                key={c.id}
                role="option"
                aria-selected={c.id === activeCommittee.id}
                onClick={() => select(c)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-white/8 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white font-medium leading-tight truncate">
                    {c.name}
                  </p>
                  {c.city && (
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      {c.city} · {c.electionYear}
                    </p>
                  )}
                </div>
                {c.id === activeCommittee.id && (
                  <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); router.push('/app/create-committee') }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-white/8 transition-colors"
              >
                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3 text-slate-300" />
                </div>
                <span className="text-[12px] text-slate-300 font-medium">New committee</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
