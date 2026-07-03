import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import { getExpenditures, getUnrecordedAnedotFees } from '@/actions/expenses'
import { getContributions } from '@/actions/donations'
import { getReimbursements } from '@/actions/reimbursements'
import ExpensesTabs from '@/components/expenses/ExpensesTabs'
import { getEvents } from '@/actions/events'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function ExpensesPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)
  const canEdit = canEditFinances(role)

  const [expenditures, contributions, events, reimbursements, unrecordedFees] = await Promise.all([
    getExpenditures(committee.id),
    getContributions(committee.id),
    getEvents(committee.id),
    getReimbursements(committee.id),
    getUnrecordedAnedotFees(committee.id),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <ExpensesTabs
          expenditures={expenditures}
          contributions={contributions}
          reimbursements={reimbursements}
          events={events}
          committeeId={committee.id}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
          unrecordedFees={unrecordedFees}
        />
      </div>
    </div>
  )
}
