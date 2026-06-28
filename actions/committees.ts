'use server'

import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import type { Committee } from '@/lib/types'

function mapCommittee(c: {
  id: string
  name: string
  slug: string
  seecId: string | null
  city: string | null
  state: string
  electionYear: number | null
}): Committee {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    seecId: c.seecId ?? undefined,
    city: c.city ?? undefined,
    state: c.state,
    electionYear: c.electionYear ?? undefined,
  }
}

/** All committees the current user belongs to */
export async function getCommitteesForUser(): Promise<Committee[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const memberships = await prisma.committeeMembership.findMany({
    where: { userId: user.id },
    include: { committee: true },
    orderBy: { committee: { name: 'asc' } },
  })

  return memberships.map((m: { committee: Parameters<typeof mapCommittee>[0] }) => mapCommittee(m.committee))
}

/** Single committee by slug — verifies the current user has access */
export async function getCommitteeBySlug(slug: string): Promise<Committee | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committee: { slug } },
    include: { committee: true },
  })

  return membership ? mapCommittee(membership.committee) : null
}
