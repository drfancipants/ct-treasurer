import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import Sidebar from '@/components/layout/Sidebar'
import type { Committee } from '@/lib/types'

interface Props {
  children: React.ReactNode
  params: { committeeSlug: string }
}

function mapCommittee(c: {
  id: string; name: string; slug: string; seecId: string | null
  anedotAccountId: string | null; address1: string | null; address2: string | null
  city: string | null; state: string; zip: string | null; phone: string | null
  email: string | null; electionYear: number | null
}): Committee {
  return {
    id: c.id, name: c.name, slug: c.slug,
    seecId: c.seecId ?? undefined,
    anedotAccountId: c.anedotAccountId ?? undefined,
    address1: c.address1 ?? undefined,
    address2: c.address2 ?? undefined,
    city: c.city ?? undefined,
    state: c.state,
    zip: c.zip ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    electionYear: c.electionYear ?? undefined,
  }
}

export default async function CommitteeLayout({ children, params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const memberships = await prisma.committeeMembership.findMany({
    where: { userId: user.id },
    include: { committee: true },
    orderBy: { committee: { name: 'asc' } },
  })

  const committees = memberships.map((m: { committee: Parameters<typeof mapCommittee>[0] }) => mapCommittee(m.committee))
  const activeCommittee = committees.find((c: { slug: string }) => c.slug === params.committeeSlug)
  if (!activeCommittee) notFound()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar committees={committees} activeCommittee={activeCommittee} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
