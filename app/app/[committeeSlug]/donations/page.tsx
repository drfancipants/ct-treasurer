import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getContributions } from '@/actions/donations'
import DonationSummaryCards from '@/components/donations/DonationSummaryCards'
import DonationsTable from '@/components/donations/DonationsTable'

interface Props {
  params: { committeeSlug: string }
}

export default async function DonationsPage({ params }: Props) {
  const committee = await getCommitteeBySlug(params.committeeSlug)
  if (!committee) notFound()

  const contributions = await getContributions(committee.id)

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <DonationSummaryCards contributions={contributions} />
        <DonationsTable contributions={contributions} committeeId={committee.id} committeeSlug={params.committeeSlug} />
      </div>
    </div>
  )
}
