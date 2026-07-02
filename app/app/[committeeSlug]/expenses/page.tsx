import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import { getExpenditures } from '@/actions/expenses'
import { getContributions } from '@/actions/donations'
import ExpenseSummaryCards from '@/components/expenses/ExpenseSummaryCards'
import ExpensesTable from '@/components/expenses/ExpensesTable'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function ExpensesPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)
  const canEdit = canEditFinances(role)

  const [expenditures, contributions] = await Promise.all([
    getExpenditures(committee.id),
    getContributions(committee.id),
  ])

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <ExpenseSummaryCards expenditures={expenditures} contributions={contributions} />
        <ExpensesTable expenditures={expenditures} committeeId={committee.id} committeeSlug={committeeSlug} canEdit={canEdit} />
      </div>
    </div>
  )
}
