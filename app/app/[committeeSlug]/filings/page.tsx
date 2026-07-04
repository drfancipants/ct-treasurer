import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getContributions } from '@/actions/donations'
import { getExpenditures } from '@/actions/expenses'
import { getFilings, getCustomFilingPeriods } from '@/actions/filings'
import { getEvents } from '@/actions/events'
import { getCommitteeContributions } from '@/actions/committee-contributions'
import { getInKindContributions } from '@/actions/in-kind-contributions'
import { getReimbursements } from '@/actions/reimbursements'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import FilingsList from '@/components/filings/FilingsList'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function FilingsPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)
  const canEdit = canEditFinances(role)

  const [contributions, expenditures, filings, customPeriods, events, committeeContributions, inKindContributions, reimbursements] = await Promise.all([
    getContributions(committee.id),
    getExpenditures(committee.id),
    getFilings(committee.id),
    getCustomFilingPeriods(committee.id),
    getEvents(committee.id),
    getCommitteeContributions(committee.id),
    getInKindContributions(committee.id),
    getReimbursements(committee.id),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <FilingsList
          contributions={contributions}
          expenditures={expenditures}
          events={events}
          committeeContributions={committeeContributions}
          inKindContributions={inKindContributions}
          reimbursements={reimbursements}
          committee={committee}
          filings={filings}
          customPeriods={customPeriods}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
