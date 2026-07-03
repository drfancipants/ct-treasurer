'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireRosterRole } from '@/lib/auth'
import type { RosterMember } from '@/lib/types'
import type { ParsedRosterRow } from '@/lib/roster-csv'

type PrismaRow = {
  id: string
  committeeId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string
  zip: string | null
  isActive: boolean
  duesPaid: boolean
  notes: string | null
  createdAt: Date
}

function mapRow(r: PrismaRow, contributionTotal = 0): RosterMember {
  return {
    id: r.id,
    committeeId: r.committeeId,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    address1: r.address1 ?? undefined,
    address2: r.address2 ?? undefined,
    city: r.city ?? undefined,
    state: r.state,
    zip: r.zip ?? undefined,
    isActive: r.isActive,
    duesPaid: r.duesPaid,
    notes: r.notes ?? undefined,
    contributionTotal,
    createdAt: r.createdAt.toISOString(),
  }
}

/**
 * Contribution totals are matched through Contributor.email (Contributor is
 * global and email-matched by design — see CLAUDE.md), scoped to this
 * committee's contributions only.
 */
async function contributionTotalsByEmail(committeeId: string, emails: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>()
  if (emails.length === 0) return totals

  const contributors = await prisma.contributor.findMany({
    where: { email: { in: emails, mode: 'insensitive' } },
    select: { id: true, email: true },
  })
  if (contributors.length === 0) return totals

  const sums = await prisma.contribution.groupBy({
    by: ['contributorId'],
    where: { committeeId, contributorId: { in: contributors.map((c) => c.id) } },
    _sum: { amount: true },
  })
  const sumByContributor = new Map(sums.map((s) => [s.contributorId, Number(s._sum.amount?.toString() ?? 0)]))

  for (const c of contributors) {
    if (!c.email) continue
    const key = c.email.toLowerCase()
    totals.set(key, (totals.get(key) ?? 0) + (sumByContributor.get(c.id) ?? 0))
  }
  return totals
}

async function fetchRoster(committeeId: string): Promise<RosterMember[]> {
  const rows = await prisma.rosterMember.findMany({
    where: { committeeId },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const emails = [...new Set(rows.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e))]
  const totals = await contributionTotalsByEmail(committeeId, emails)

  return rows.map((r) => mapRow(r, r.email ? totals.get(r.email.toLowerCase()) ?? 0 : 0))
}

export async function getRosterMembers(committeeId: string): Promise<RosterMember[]> {
  await requireCommitteeMemberById(committeeId)
  return fetchRoster(committeeId)
}

export interface RosterMemberInput {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  isActive: boolean
  duesPaid: boolean
  notes?: string
}

function toData(data: RosterMemberInput) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email?.toLowerCase() || null,
    phone: data.phone || null,
    address1: data.address1 || null,
    address2: data.address2 || null,
    city: data.city || null,
    state: data.state || 'CT',
    zip: data.zip || null,
    isActive: data.isActive,
    duesPaid: data.duesPaid,
    notes: data.notes || null,
  }
}

async function totalForEmail(committeeId: string, email: string | null): Promise<number> {
  if (!email) return 0
  const totals = await contributionTotalsByEmail(committeeId, [email.toLowerCase()])
  return totals.get(email.toLowerCase()) ?? 0
}

export async function createRosterMember(
  committeeId: string,
  data: RosterMemberInput,
  committeeSlug: string
): Promise<RosterMember> {
  const { committeeId: verifiedId } = await requireRosterRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const row = await prisma.rosterMember.create({ data: { committeeId, ...toData(data) } })
  revalidatePath(`/app/${committeeSlug}/members`)
  return mapRow(row, await totalForEmail(committeeId, row.email))
}

export async function updateRosterMember(
  id: string,
  data: RosterMemberInput,
  committeeSlug: string
): Promise<RosterMember> {
  const { committeeId } = await requireRosterRole(committeeSlug)
  const existing = await prisma.rosterMember.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  const row = await prisma.rosterMember.update({ where: { id }, data: toData(data) })
  revalidatePath(`/app/${committeeSlug}/members`)
  return mapRow(row, await totalForEmail(committeeId, row.email))
}

/** Quick toggles for the two "maintain" flags, used inline in the table. */
export async function setRosterMemberFlags(
  id: string,
  flags: { isActive?: boolean; duesPaid?: boolean },
  committeeSlug: string
): Promise<void> {
  const { committeeId } = await requireRosterRole(committeeSlug)
  const existing = await prisma.rosterMember.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  // Whitelist — server actions can be invoked with arbitrary payloads
  const data: { isActive?: boolean; duesPaid?: boolean } = {}
  if (typeof flags.isActive === 'boolean') data.isActive = flags.isActive
  if (typeof flags.duesPaid === 'boolean') data.duesPaid = flags.duesPaid
  await prisma.rosterMember.update({ where: { id }, data })
  revalidatePath(`/app/${committeeSlug}/members`)
}

/**
 * Bulk create/update from a parsed CSV (see lib/roster-csv.ts). Update rows
 * only overwrite fields the CSV actually provided; blank cells leave the
 * existing values untouched. Returns the full refreshed roster.
 */
export async function importRosterMembers(
  committeeId: string,
  rows: ParsedRosterRow[],
  committeeSlug: string
): Promise<{ members: RosterMember[]; created: number; updated: number }> {
  const { committeeId: verifiedId } = await requireRosterRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const importable = rows.filter((r) => !r.isError && r.lastName?.trim())

  // Re-verify every claimed existingId against this committee — the payload
  // comes from the client and cannot be trusted
  const claimedIds = importable.filter((r) => r.action === 'update' && r.existingId).map((r) => r.existingId!)
  const validIds = new Set(
    (await prisma.rosterMember.findMany({
      where: { id: { in: claimedIds }, committeeId },
      select: { id: true },
    })).map((r) => r.id)
  )

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

  let created = 0
  let updated = 0
  await prisma.$transaction(
    importable.map((r) => {
      const fields = {
        firstName: str(r.firstName) ?? '',
        lastName: str(r.lastName) ?? '',
        email: str(r.email)?.toLowerCase(),
        phone: str(r.phone),
        address1: str(r.address1),
        address2: str(r.address2),
        city: str(r.city),
        state: str(r.state),
        zip: str(r.zip),
        isActive: bool(r.isActive),
        duesPaid: bool(r.duesPaid),
        notes: str(r.notes),
      }
      if (r.action === 'update' && r.existingId && validIds.has(r.existingId)) {
        updated++
        // Only set fields the CSV provided — undefined keys are ignored by Prisma
        return prisma.rosterMember.update({
          where: { id: r.existingId },
          data: {
            firstName: fields.firstName || undefined,
            lastName: fields.lastName || undefined,
            email: fields.email,
            phone: fields.phone,
            address1: fields.address1,
            address2: fields.address2,
            city: fields.city,
            state: fields.state,
            zip: fields.zip,
            isActive: fields.isActive,
            duesPaid: fields.duesPaid,
            notes: fields.notes,
          },
        })
      }
      created++
      return prisma.rosterMember.create({
        data: {
          committeeId,
          firstName: fields.firstName,
          lastName: fields.lastName,
          email: fields.email ?? null,
          phone: fields.phone ?? null,
          address1: fields.address1 ?? null,
          address2: fields.address2 ?? null,
          city: fields.city ?? null,
          state: fields.state ?? 'CT',
          zip: fields.zip ?? null,
          isActive: fields.isActive ?? true,
          duesPaid: fields.duesPaid ?? false,
          notes: fields.notes ?? null,
        },
      })
    })
  )

  revalidatePath(`/app/${committeeSlug}/members`)
  return { members: await fetchRoster(committeeId), created, updated }
}

export async function deleteRosterMember(id: string, committeeSlug: string) {
  const { committeeId } = await requireRosterRole(committeeSlug)
  const existing = await prisma.rosterMember.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  await prisma.rosterMember.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/members`)
}
