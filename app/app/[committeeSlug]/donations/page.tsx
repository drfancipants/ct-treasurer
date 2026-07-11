import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import { getContributions } from '@/actions/donations'
import { getEvents } from '@/actions/events'
import { getCommitteeContributions } from '@/actions/committee-contributions'
import { getInKindContributions } from '@/actions/in-kind-contributions'
import { getRosterMembers } from '@/actions/roster'
import { getLimitPolicy } from '@/lib/limits'
import DonationsTabs from '@/components/donations/DonationsTabs'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function DonationsPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)
  const canEdit = canEditFinances(role)

  const [contributions, events, committeeContributions, inKindContributions, rosterMembers] = await Promise.all([
    getContributions(committee.id),
    getEvents(committee.id),
    getCommitteeContributions(committee.id),
    getInKindContributions(committee.id),
    getRosterMembers(committee.id),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <DonationsTabs
          contributions={contributions}
          committeeContributions={committeeContributions}
          inKindContributions={inKindContributions}
          rosterMembers={rosterMembers}
          events={events}
          committeeId={committee.id}
          committeeSlug={committeeSlug}
          canEdit={canEdit}
          policy={getLimitPolicy(committee)}
        />
      </div>
    </div>
  )
}
