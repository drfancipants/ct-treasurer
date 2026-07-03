import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { mapCommittee } from '@/lib/map-committee'
import { isCommitteeEntitled } from '@/lib/entitlement'
import SubscribeCard from '@/components/billing/SubscribeCard'

interface Props {
  searchParams: Promise<{ committee?: string }>
}

export default async function SubscribePage({ searchParams }: Props) {
  const { committee: slug } = await searchParams
  if (!slug) redirect('/app')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Must be a member to see a committee's subscribe screen
  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committee: { slug } },
    include: { committee: true },
  })
  if (!membership) notFound()

  const committee = mapCommittee(membership.committee)

  // Already paid/in trial — nothing to do here
  if (isCommitteeEntitled(committee)) {
    redirect(`/app/${slug}/dashboard`)
  }

  const canManageBilling =
    membership.role === 'TREASURER' || membership.role === 'ASSISTANT_TREASURER'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <SubscribeCard committee={committee} canManageBilling={canManageBilling} />
    </div>
  )
}
