import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getMembers } from '@/actions/members'
import { getRosterMembers } from '@/actions/roster'
import { requireCommitteeMember, canEditRoster } from '@/lib/auth'
import MembersTabs from '@/components/members/MembersTabs'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function MembersPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)

  const [members, rosterMembers] = await Promise.all([
    getMembers(committee.id),
    getRosterMembers(committee.id),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <MembersTabs
          rosterMembers={rosterMembers}
          members={members}
          committeeId={committee.id}
          committeeSlug={committeeSlug}
          committeeName={committee.name}
          canEditRoster={canEditRoster(role)}
        />
      </div>
    </div>
  )
}
