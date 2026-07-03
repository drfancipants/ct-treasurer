'use client'

import { useState } from 'react'
import type { Contribution, Expenditure, Reimbursement, CommitteeEvent } from '@/lib/types'
import type { UnrecordedFees } from '@/actions/expenses'
import { cn } from '@/lib/utils'
import ExpenseSummaryCards from './ExpenseSummaryCards'
import ExpensesTable from './ExpensesTable'
import ReimbursementsTable from './ReimbursementsTable'

type Tab = 'expenses' | 'reimbursements'

interface Props {
  expenditures: Expenditure[]
  contributions: Contribution[]
  reimbursements: Reimbursement[]
  events: CommitteeEvent[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
  unrecordedFees?: UnrecordedFees
}

export default function ExpensesTabs({
  expenditures, contributions, reimbursements, events, committeeId, committeeSlug, canEdit, unrecordedFees,
}: Props) {
  const [tab, setTab] = useState<Tab>('expenses')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        {([['expenses', 'Committee expenses'], ['reimbursements', 'Worker reimbursements']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
            {key === 'reimbursements' && reimbursements.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-400">{reimbursements.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <>
          <ExpenseSummaryCards expenditures={expenditures} contributions={contributions} />
          <ExpensesTable
            expenditures={expenditures}
            events={events}
            committeeId={committeeId}
            committeeSlug={committeeSlug}
            canEdit={canEdit}
            unrecordedFees={unrecordedFees}
          />
        </>
      )}
      {tab === 'reimbursements' && (
        <ReimbursementsTable
          reimbursements={reimbursements}
          expenditures={expenditures}
          events={events}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
