'use client'

import { useState } from 'react'
import type { CommitteeMember, RosterMember } from '@/lib/types'
import { cn } from '@/lib/utils'
import MembersTable from './MembersTable'
import RosterTable from './RosterTable'

type Tab = 'roster' | 'access'

interface Props {
  rosterMembers: RosterMember[]
  members: CommitteeMember[]
  committeeId: string
  committeeSlug: string
  committeeName: string
  canEditRoster: boolean
  showDues?: boolean
}

export default function MembersTabs({
  rosterMembers, members, committeeId, committeeSlug, committeeName, canEditRoster, showDues = true,
}: Props) {
  const [tab, setTab] = useState<Tab>('roster')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {([['roster', 'Committee roster'], ['access', 'App access']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
            {key === 'roster' && rosterMembers.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">{rosterMembers.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <RosterTable
          members={rosterMembers}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          canEdit={canEditRoster}
          showDues={showDues}
        />
      )}
      {tab === 'access' && (
        <MembersTable
          members={members}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          committeeName={committeeName}
        />
      )}
    </div>
  )
}
