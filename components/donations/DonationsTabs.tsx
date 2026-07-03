'use client'

import { useState } from 'react'
import type { Contribution, CommitteeContribution, CommitteeEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import DonationSummaryCards from './DonationSummaryCards'
import DonationsTable from './DonationsTable'
import CommitteeContributionsTable from './CommitteeContributionsTable'

type Tab = 'individuals' | 'committees'

interface Props {
  contributions: Contribution[]
  committeeContributions: CommitteeContribution[]
  events: CommitteeEvent[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
}

export default function DonationsTabs({
  contributions, committeeContributions, events, committeeId, committeeSlug, canEdit,
}: Props) {
  const [tab, setTab] = useState<Tab>('individuals')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        {([['individuals', 'Individuals'], ['committees', 'Other committees']] as [Tab, string][]).map(([key, label]) => (
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
          </button>
        ))}
      </div>

      {tab === 'individuals' ? (
        <>
          <DonationSummaryCards contributions={contributions} />
          <DonationsTable
            contributions={contributions}
            events={events}
            committeeId={committeeId}
            committeeSlug={committeeSlug}
            canEdit={canEdit}
          />
        </>
      ) : (
        <CommitteeContributionsTable
          contributions={committeeContributions}
          events={events}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
