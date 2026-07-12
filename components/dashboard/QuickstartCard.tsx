'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { X, ArrowRight, DollarSign, Receipt, Building2, Users, FileText, BookOpen } from 'lucide-react'

interface Props {
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

const storageKey = (committeeId: string) => `quickstart-dismissed-${committeeId}`
const emptySubscribe = () => () => {}

export default function QuickstartCard({ committeeId, committeeSlug, canEdit }: Props) {
  const [dismissedNow, setDismissedNow] = useState(false)
  // Server snapshot says "dismissed" so a previously dismissed card never
  // flashes; the real localStorage value takes over after hydration
  const dismissedStored = useSyncExternalStore(
    emptySubscribe,
    () => localStorage.getItem(storageKey(committeeId)) !== null,
    () => true
  )

  if (dismissedStored || dismissedNow) return null

  const dismiss = () => {
    localStorage.setItem(storageKey(committeeId), '1')
    setDismissedNow(true)
  }

  const links = [
    ...(canEdit
      ? [
          { href: `/app/${committeeSlug}/donations`, icon: DollarSign, label: 'Record a donation' },
          { href: `/app/${committeeSlug}/expenses`, icon: Receipt, label: 'Record an expense' },
          { href: `/app/${committeeSlug}/bank`, icon: Building2, label: 'Connect your bank' },
        ]
      : []),
    { href: `/app/${committeeSlug}/members`, icon: Users, label: 'Invite your team' },
    { href: `/app/${committeeSlug}/filings`, icon: FileText, label: 'View filing calendar' },
  ]

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Getting started</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Your committee is set up — here&apos;s the fastest path to your first SEEC filing.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-blue-600" />
            {label}
          </Link>
        ))}
      </div>

      <Link
        href="/quickstart"
        target="_blank"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        <BookOpen className="w-3.5 h-3.5" />
        Read the full quickstart tutorial
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
