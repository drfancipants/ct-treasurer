import { notFound } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { getCommitteeBySlug } from '@/actions/committees'
import { getGmailConnection } from '@/actions/newsletter'
import CommitteeSettingsForm from '@/components/settings/CommitteeSettingsForm'
import BillingCard from '@/components/settings/BillingCard'
import GmailConnectCard from '@/components/settings/GmailConnectCard'
import ChangePasswordCard from '@/components/settings/ChangePasswordCard'

interface Props {
  params: Promise<{ committeeSlug: string }>
  searchParams: Promise<{ billing?: string }>
}

export default async function SettingsPage({ params, searchParams }: Props) {
  const { committeeSlug } = await params
  const { billing } = await searchParams
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()
  const gmailConnection = await getGmailConnection(committeeSlug)

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Committee settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Update your committee&apos;s registration details, contact info, and integrations
          </p>
        </div>

        {billing === 'success' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>You&apos;re subscribed! Your 14-day free trial has started — no charge until it ends.</span>
          </div>
        )}

        {billing === 'canceled' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
            Checkout was canceled — your subscription was not changed.
          </div>
        )}

        <CommitteeSettingsForm committee={committee} />
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">Account</h2>
          <ChangePasswordCard />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">Billing</h2>
          <BillingCard committee={committee} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">Newsletter email</h2>
          <GmailConnectCard committeeSlug={committeeSlug} initialConnection={gmailConnection} />
        </div>
      </div>
    </div>
  )
}
