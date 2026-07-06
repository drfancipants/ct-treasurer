import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getContributions } from '@/actions/donations'
import { getEvents } from '@/actions/events'
import ContributionsReport from '@/components/reports/ContributionsReport'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function ReportsPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const [contributions, events] = await Promise.all([
    getContributions(committee.id),
    getEvents(committee.id),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Contribution totals for {committee.name}
          </p>
        </div>
        <ContributionsReport contributions={contributions} events={events} committeeId={committee.id} />
      </div>
    </div>
  )
}
