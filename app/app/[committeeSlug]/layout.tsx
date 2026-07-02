import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { mapCommittee } from '@/lib/map-committee'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import SubscriptionBanner from '@/components/layout/SubscriptionBanner'

interface Props {
  children: React.ReactNode
  params: Promise<{ committeeSlug: string }>
}

export default async function CommitteeLayout({ children, params }: Props) {
  const { committeeSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const memberships = await prisma.committeeMembership.findMany({
    where: { userId: user.id },
    include: { committee: true },
    orderBy: { committee: { name: 'asc' } },
  })

  const committees = memberships.map((m: { committee: Parameters<typeof mapCommittee>[0] }) => mapCommittee(m.committee))
  const activeCommittee = committees.find((c: { slug: string }) => c.slug === committeeSlug)
  if (!activeCommittee) notFound()

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar committees={committees} activeCommittee={activeCommittee} />
      </div>
      {/* Phone top bar + drawer */}
      <MobileHeader committees={committees} activeCommittee={activeCommittee} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <SubscriptionBanner committee={activeCommittee} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
