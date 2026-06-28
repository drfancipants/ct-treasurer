import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getContributions } from '@/actions/donations'
import { getExpenditures } from '@/actions/expenses'
import { getFilings } from '@/actions/filings'
import FilingsList from '@/components/filings/FilingsList'

interface Props {
  params: { committeeSlug: string }
}

export default async function FilingsPage({ params }: Props) {
  const committee = await getCommitteeBySlug(params.committeeSlug)
  if (!committee) notFound()

  const [contributions, expenditures, filings] = await Promise.all([
    getContributions(committee.id),
    getExpenditures(committee.id),
    getFilings(committee.id),
  ])

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <FilingsList
          contributions={contributions}
          expenditures={expenditures}
          committee={committee}
          filings={filings}
        />
      </div>
    </div>
  )
}
