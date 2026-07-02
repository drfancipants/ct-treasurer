import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import { getContributions } from '@/actions/donations'
import DonationSummaryCards from '@/components/donations/DonationSummaryCards'
import DonationsTable from '@/components/donations/DonationsTable'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function DonationsPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)
  const canEdit = canEditFinances(role)

  const contributions = await getContributions(committee.id)

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <DonationSummaryCards contributions={contributions} />
        <DonationsTable contributions={contributions} committeeId={committee.id} committeeSlug={committeeSlug} canEdit={canEdit} />
      </div>
    </div>
  )
}
