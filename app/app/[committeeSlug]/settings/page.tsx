import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import CommitteeSettingsForm from '@/components/settings/CommitteeSettingsForm'

export default async function SettingsPage({ params }: { params: Promise<{ committeeSlug: string }> }) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Committee settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Update your committee's registration details, contact info, and integrations
          </p>
        </div>
        <CommitteeSettingsForm committee={committee} />
      </div>
    </div>
  )
}
