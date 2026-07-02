import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getMembers } from '@/actions/members'
import MembersTable from '@/components/members/MembersTable'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function MembersPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const members = await getMembers(committee.id)

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <MembersTable members={members} committeeId={committee.id} committeeSlug={committeeSlug} committeeName={committee.name} />
      </div>
    </div>
  )
}
