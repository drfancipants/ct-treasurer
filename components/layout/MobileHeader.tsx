'use client'

import { useState } from 'react'
import { Menu, X, Scale } from 'lucide-react'
import type { Committee } from '@/lib/types'
import Sidebar from './Sidebar'

/**
 * Phone-width app shell header: a slim top bar with a hamburger that opens
 * the full Sidebar as a slide-over drawer. Hidden at md and up, where the
 * regular sidebar takes over.
 */
export default function MobileHeader({
  committees,
  activeCommittee,
}: {
  committees: Committee[]
  activeCommittee: Committee
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-3 bg-navy-900 text-white">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500 shrink-0">
            <Scale className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-sm font-medium truncate">{activeCommittee.name}</p>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Close on any nav-link tap inside the drawer (avoids a
              setState-in-effect on pathname) */}
          <div
            className="absolute inset-y-0 left-0 shadow-2xl"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false)
            }}
          >
            <Sidebar committees={committees} activeCommittee={activeCommittee} />
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="absolute top-3 left-[15.5rem] p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
