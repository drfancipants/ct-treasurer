import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id },
    include: { committee: true },
    orderBy: { committee: { name: 'asc' } },
  })

  if (!membership) redirect('/app')

  redirect(`/app/${membership.committee.slug}/donations`)
}
