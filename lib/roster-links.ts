import { prisma } from './db'

// ─── Pure matching logic (unit-tested) ────────────────────────────────────────

export interface MatchableMember {
  id: string
  firstName: string
  lastName: string
  email?: string | null
}

export interface MatchableContributor {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  /** Name matching is only trusted for people who have donated to this committee */
  isCommitteeDonor: boolean
}

function nameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`
}

/**
 * Match roster members to contributors: email first (strong signal, matched
 * globally), then first+last name (weaker — only among this committee's
 * donors, and skipped when the name is ambiguous). Each contributor links to
 * at most one member. Returns memberId → contributorId pairs.
 */
export function matchRosterToContributors(
  members: MatchableMember[],
  contributors: MatchableContributor[],
  alreadyLinkedContributorIds: Set<string> = new Set()
): Map<string, string> {
  const used = new Set(alreadyLinkedContributorIds)
  const links = new Map<string, string>()

  const byEmail = new Map<string, string>()
  for (const c of contributors) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id)
  }

  // Name buckets — a name shared by several donors is ambiguous, don't guess
  const byName = new Map<string, string[]>()
  for (const c of contributors) {
    if (!c.isCommitteeDonor) continue
    const key = nameKey(c.firstName, c.lastName)
    byName.set(key, [...(byName.get(key) ?? []), c.id])
  }

  for (const m of members) {
    let contributorId: string | undefined
    if (m.email) contributorId = byEmail.get(m.email.toLowerCase())
    if (!contributorId) {
      const candidates = byName.get(nameKey(m.firstName, m.lastName)) ?? []
      if (candidates.length === 1) contributorId = candidates[0]
    }
    if (contributorId && !used.has(contributorId)) {
      links.set(m.id, contributorId)
      used.add(contributorId)
    }
  }
  return links
}

// ─── Prisma-backed sync ───────────────────────────────────────────────────────

/**
 * Link any unlinked roster members of this committee to matching contributors.
 * Idempotent and additive — existing links are never changed here. Call after
 * any write that creates contributors or roster members.
 */
export async function syncRosterContributorLinks(committeeId: string): Promise<number> {
  const unlinked = await prisma.rosterMember.findMany({
    where: { committeeId, contributorId: null },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  if (unlinked.length === 0) return 0

  const linked = await prisma.rosterMember.findMany({
    where: { committeeId, contributorId: { not: null } },
    select: { contributorId: true },
  })

  const emails = unlinked.map((m) => m.email).filter((e): e is string => !!e)
  const [emailMatches, committeeDonors] = await Promise.all([
    emails.length > 0
      ? prisma.contributor.findMany({
          where: { email: { in: emails, mode: 'insensitive' } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : Promise.resolve([]),
    prisma.contributor.findMany({
      where: { contributions: { some: { committeeId } } },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ])

  const donorIds = new Set(committeeDonors.map((c) => c.id))
  const contributors: MatchableContributor[] = [
    ...committeeDonors.map((c) => ({ ...c, isCommitteeDonor: true })),
    ...emailMatches.filter((c) => !donorIds.has(c.id)).map((c) => ({ ...c, isCommitteeDonor: false })),
  ]

  const links = matchRosterToContributors(
    unlinked,
    contributors,
    new Set(linked.map((l) => l.contributorId!))
  )
  if (links.size === 0) return 0

  await prisma.$transaction(
    [...links.entries()].map(([memberId, contributorId]) =>
      prisma.rosterMember.update({ where: { id: memberId }, data: { contributorId } })
    )
  )
  return links.size
}
