'use client'

import { useState } from 'react'
import type { Contribution, CommitteeContribution, InKindContribution, CommitteeEvent, RosterMember } from '@/lib/types'
import { cn } from '@/lib/utils'
import DonationSummaryCards from './DonationSummaryCards'
import DonationsTable from './DonationsTable'
import CommitteeContributionsTable from './CommitteeContributionsTable'
import InKindContributionsTable from './InKindContributionsTable'

type Tab = 'individuals' | 'committees' | 'inkind'

interface Props {
  contributions: Contribution[]
  committeeContributions: CommitteeContribution[]
  inKindContributions: InKindContribution[]
  rosterMembers: RosterMember[]
  events: CommitteeEvent[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function DonationsTabs({
  contributions, committeeContributions, inKindContributions, rosterMembers, events, committeeId, committeeSlug, canEdit,
}: Props) {
  const [tab, setTab] = useState<Tab>('individuals')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        {([['individuals', 'Individuals'], ['committees', 'Other committees'], ['inkind', 'In-kind']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
            {key === 'committees' && committeeContributions.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">{committeeContributions.length}</span>
            )}
            {key === 'inkind' && inKindContributions.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">{inKindContributions.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'individuals' && (
        <>
          <DonationSummaryCards contributions={contributions} />
          <DonationsTable
            contributions={contributions}
            events={events}
            rosterMembers={rosterMembers}
            committeeId={committeeId}
            committeeSlug={committeeSlug}
            canEdit={canEdit}
          />
        </>
      )}
      {tab === 'committees' && (
        <CommitteeContributionsTable
          contributions={committeeContributions}
          events={events}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
        />
      )}
      {tab === 'inkind' && (
        <InKindContributionsTable
          contributions={inKindContributions}
          events={events}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
