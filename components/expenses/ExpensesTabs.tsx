'use client'

import { useState } from 'react'
import type { Contribution, Expenditure, Reimbursement, CommitteeEvent, Payee, CommitteeContribution } from '@/lib/types'
import type { UnrecordedFees } from '@/actions/expenses'
import { cn } from '@/lib/utils'
import ExpenseSummaryCards from './ExpenseSummaryCards'
import ExpensesTable from './ExpensesTable'
import ReimbursementsTable from './ReimbursementsTable'
import PayeesTable from './PayeesTable'

type Tab = 'expenses' | 'reimbursements' | 'payees'

interface Props {
  expenditures: Expenditure[]
  contributions: Contribution[]
  committeeContributions?: CommitteeContribution[]
  reimbursements: Reimbursement[]
  events: CommitteeEvent[]
  payees: Payee[]
  committeeId: string
  committeeSlug: string
  canEdit: boolean
  unrecordedFees?: UnrecordedFees
}

export default function ExpensesTabs({
  expenditures, contributions, committeeContributions, reimbursements, events, payees: initialPayees, committeeId, committeeSlug, canEdit, unrecordedFees,
}: Props) {
  const [tab, setTab] = useState<Tab>('expenses')
  const [payees, setPayees] = useState(initialPayees)

  function handlePayeeCreated(payee: Payee) {
    setPayees((prev) => [...prev, payee].sort((a, b) => a.name.localeCompare(b.name)))
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        {([['expenses', 'Committee expenses'], ['reimbursements', 'Worker reimbursements'], ['payees', 'Payees']] as [Tab, string][]).map(([key, label]) => (
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
          <ExpenseSummaryCards expenditures={expenditures} contributions={contributions} committeeContributions={committeeContributions} />
          <ExpensesTable
            expenditures={expenditures}
            events={events}
            payees={payees}
            onPayeeCreated={handlePayeeCreated}
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
      {tab === 'payees' && (
        <PayeesTable
          payees={payees}
          committeeId={committeeId}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
