'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Users,
  DollarSign,
  CreditCard,
  Building2,
  FileText,
  FileBarChart,
  CalendarDays,
  Settings,
  Scale,
  LogOut,
  Mail,
} from 'lucide-react'
import CommitteeSwitcher from './CommitteeSwitcher'
import type { Committee } from '@/lib/types'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { segment: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { segment: 'members', label: 'Members', icon: Users },
  { segment: 'donations', label: 'Donations', icon: DollarSign },
  { segment: 'expenses', label: 'Expenses', icon: CreditCard },
  { segment: 'bank', label: 'Bank accounts', icon: Building2 },
  { segment: 'filings', label: 'SEEC filings', icon: FileText },
  { segment: 'events', label: 'Events', icon: CalendarDays },
  { segment: 'reports', label: 'Reports', icon: FileBarChart },
  { segment: 'newsletter', label: 'Newsletter', icon: Mail },
]

interface Props {
  committees: Committee[]
  activeCommittee: Committee
}

export default function Sidebar({ committees, activeCommittee }: Props) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-60 h-screen bg-navy-900 shrink-0 select-none">
      {/* Branding */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500">
          <Scale className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-white">CT Committee</p>
          <p className="text-[11px] text-slate-400">Treasurer Suite</p>
        </div>
      </div>

      {/* Committee switcher */}
      <div className="px-3 py-3 border-b border-white/10">
        <CommitteeSwitcher committees={committees} activeCommittee={activeCommittee} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const href = `/app/${activeCommittee.slug}/${item.segment}`
          const isActive = pathname.startsWith(href)
          const Icon = item.icon

          return (
            <Link
              key={item.segment}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors',
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/10 space-y-1">
        <Link
          href={`/app/${activeCommittee.slug}/settings`}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors',
            pathname.startsWith(`/app/${activeCommittee.slug}/settings`)
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-white hover:bg-white/8'
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </Link>

        <div className="px-3 py-2 rounded-lg bg-white/5">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">
            SEEC ID
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {activeCommittee.seecId ?? 'Not registered'}
          </p>
        </div>

        <UserProfile />
      </div>
    </aside>
  )
}

function UserProfile() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Lazy-import to avoid SSR issues
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUser({
            name: data.user.user_metadata?.name ?? data.user.email?.split('@')[0],
            email: data.user.email,
          })
        }
      })
    })
  }, [])

  async function signOut() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!user) return null

  const initials = (user.name ?? 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/5 mt-1">
      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-white font-medium truncate leading-tight">{user.name}</p>
        <p className="text-[10px] text-slate-400 truncate leading-tight">{user.email}</p>
      </div>
      <button
        onClick={signOut}
        title="Sign out"
        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
