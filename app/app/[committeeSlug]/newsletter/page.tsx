import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getRosterMembers } from '@/actions/roster'
import { getGmailConnection, getRecentNewsletters } from '@/actions/newsletter'
import { requireCommitteeMember, canEditRoster } from '@/lib/auth'
import NewsletterComposer from '@/components/newsletter/NewsletterComposer'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function NewsletterPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)

  const [rosterMembers, gmailConnection, recentNewsletters] = await Promise.all([
    getRosterMembers(committee.id),
    getGmailConnection(committeeSlug),
    getRecentNewsletters(committeeSlug),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Newsletter</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Send an email to your committee roster
          </p>
        </div>
        <NewsletterComposer
          rosterMembers={rosterMembers}
          gmailConnection={gmailConnection}
          recentNewsletters={recentNewsletters}
          committeeSlug={committeeSlug}
          committeeName={committee.name}
          canEdit={canEditRoster(role)}
        />
      </div>
    </div>
  )
}
