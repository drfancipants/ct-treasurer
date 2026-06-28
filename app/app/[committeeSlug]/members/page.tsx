import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getMembers } from '@/actions/members'
import MembersTable from '@/components/members/MembersTable'

interface Props {
  params: { committeeSlug: string }
}

export default async function MembersPage({ params }: Props) {
  const committee = await getCommitteeBySlug(params.committeeSlug)
  if (!committee) notFound()

  const members = await getMembers(committee.id)

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <MembersTable members={members} committeeId={committee.id} committeeSlug={params.committeeSlug} committeeName={committee.name} />
      </div>
    </div>
  )
}
