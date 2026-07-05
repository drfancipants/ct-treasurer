'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireRosterRole, requireCommitteeMember } from '@/lib/auth'
import { syncRosterContributorLinks } from '@/lib/roster-links'
import { friendlyDbError } from '@/lib/friendly-db-error'
import type { RosterMember, PaymentMethod, ContributionSource } from '@/lib/types'
import type { ParsedRosterRow } from '@/lib/roster-csv'

function friendlyImportError(err: unknown, context: string): Error {
  return friendlyDbError(err, context, '[importRosterMembers]')
}

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
  contributorId: string | null
  createdAt: Date
}

interface GivingStats {
  total: number
  count: number
}

function mapRow(
  r: PrismaRow,
  giving: GivingStats = { total: 0, count: 0 },
  duesConfig: { campaign: string | null; threshold: number | null } = { campaign: null, threshold: null },
  anedotDuesTotal = 0
): RosterMember {
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
    contributorId: r.contributorId ?? undefined,
    contributionTotal: giving.total,
    contributionCount: giving.count,
    duesPaidViaAnedot:
      !!duesConfig.campaign && duesConfig.threshold != null && anedotDuesTotal >= duesConfig.threshold,
    anedotDuesTotal,
    createdAt: r.createdAt.toISOString(),
  }
}

async function givingByContributorId(
  committeeId: string,
  contributorIds: string[],
  campaign?: string
): Promise<Map<string, GivingStats>> {
  if (contributorIds.length === 0) return new Map()
  const sums = await prisma.contribution.groupBy({
    by: ['contributorId'],
    where: { committeeId, contributorId: { in: contributorIds }, ...(campaign ? { campaign } : {}) },
    _sum: { amount: true },
    _count: true,
  })
  return new Map(sums.map((s) => [
    s.contributorId,
    { total: Number(s._sum.amount?.toString() ?? 0), count: s._count },
  ]))
}

/**
 * Every contributor record a roster member's giving flows through: the linked
 * contributor plus any others sharing the member's email (duplicate donor
 * records can exist when the same address was entered with different casing).
 */
async function memberContributorIds(
  rows: { contributorId: string | null; email: string | null }[]
): Promise<{ idsFor: (r: { contributorId: string | null; email: string | null }) => string[] }> {
  const emails = [...new Set(rows.filter((r) => r.email).map((r) => r.email!.toLowerCase()))]
  const emailContributors = emails.length > 0
    ? await prisma.contributor.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true },
      })
    : []
  const idsByEmail = new Map<string, string[]>()
  for (const c of emailContributors) {
    if (!c.email) continue
    const key = c.email.toLowerCase()
    idsByEmail.set(key, [...(idsByEmail.get(key) ?? []), c.id])
  }
  return {
    idsFor: (r) => [...new Set([
      ...(r.contributorId ? [r.contributorId] : []),
      ...(r.email ? idsByEmail.get(r.email.toLowerCase()) ?? [] : []),
    ])],
  }
}

async function fetchRoster(committeeId: string): Promise<RosterMember[]> {
  const [rows, committee] = await Promise.all([
    prisma.rosterMember.findMany({
      where: { committeeId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.committee.findUnique({
      where: { id: committeeId },
      select: { duesAnedotCampaign: true, duesThreshold: true },
    }),
  ])
  const duesConfig = {
    campaign: committee?.duesAnedotCampaign ?? null,
    threshold: committee?.duesThreshold ? Number(committee.duesThreshold.toString()) : null,
  }

  const { idsFor } = await memberContributorIds(rows)
  const allIds = [...new Set(rows.flatMap(idsFor))]
  const [stats, duesStats] = await Promise.all([
    givingByContributorId(committeeId, allIds),
    duesConfig.campaign ? givingByContributorId(committeeId, allIds, duesConfig.campaign) : new Map<string, GivingStats>(),
  ])

  return rows.map((r) => {
    const ids = idsFor(r)
    const giving = ids.reduce<GivingStats>(
      (acc, id) => {
        const s = stats.get(id)
        return s ? { total: acc.total + s.total, count: acc.count + s.count } : acc
      },
      { total: 0, count: 0 }
    )
    const anedotDuesTotal = ids.reduce((sum, id) => sum + (duesStats.get(id)?.total ?? 0), 0)
    return mapRow(r, giving, duesConfig, anedotDuesTotal)
  })
}

async function fetchRosterMember(committeeId: string, id: string): Promise<RosterMember> {
  const member = (await fetchRoster(committeeId)).find((r) => r.id === id)
  if (!member) throw new Error('Not found')
  return member
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

export async function createRosterMember(
  committeeId: string,
  data: RosterMemberInput,
  committeeSlug: string
): Promise<RosterMember> {
  const { committeeId: verifiedId } = await requireRosterRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const row = await prisma.rosterMember.create({ data: { committeeId, ...toData(data) } })
  await syncRosterContributorLinks(committeeId)
  revalidatePath(`/app/${committeeSlug}/members`)
  return fetchRosterMember(committeeId, row.id)
}

export async function updateRosterMember(
  id: string,
  data: RosterMemberInput,
  committeeSlug: string
): Promise<RosterMember> {
  const { committeeId } = await requireRosterRole(committeeSlug)
  const existing = await prisma.rosterMember.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  // If the email changed, the old link may be wrong — clear it and let the
  // sync re-establish the right one
  const emailChanged = (toData(data).email ?? null) !== existing.email
  await prisma.rosterMember.update({
    where: { id },
    data: { ...toData(data), ...(emailChanged ? { contributorId: null } : {}) },
  })
  await syncRosterContributorLinks(committeeId)
  revalidatePath(`/app/${committeeSlug}/members`)
  return fetchRosterMember(committeeId, id)
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
  try {
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
  } catch (err) {
    throw friendlyImportError(err, `Failed to import ${importable.length} roster member${importable.length !== 1 ? 's' : ''}`)
  }

  await syncRosterContributorLinks(committeeId)
  revalidatePath(`/app/${committeeSlug}/members`)
  return { members: await fetchRoster(committeeId), created, updated }
}

// ─── Per-member donation history ──────────────────────────────────────────────

export interface RosterDonation {
  id: string
  date: string
  amount: number
  method: PaymentMethod
  source: ContributionSource
  memo?: string
}

/**
 * This committee's contributions from a roster member — through the
 * contributor link when present, else by email match.
 */
export async function getRosterMemberDonations(
  rosterMemberId: string,
  committeeSlug: string
): Promise<RosterDonation[]> {
  const { committeeId } = await requireCommitteeMember(committeeSlug)
  const member = await prisma.rosterMember.findFirst({ where: { id: rosterMemberId, committeeId } })
  if (!member) throw new Error('Forbidden')

  const { idsFor } = await memberContributorIds([member])
  const contributorIds = idsFor(member)
  if (contributorIds.length === 0) return []

  const rows = await prisma.contribution.findMany({
    where: { committeeId, contributorId: { in: contributorIds } },
    orderBy: { date: 'desc' },
  })
  return rows.map((c) => ({
    id: c.id,
    date: c.date.toISOString().split('T')[0],
    amount: Number(c.amount.toString()),
    method: c.method as PaymentMethod,
    source: c.source as ContributionSource,
    memo: c.memo ?? undefined,
  }))
}

/** Annual reset: mark every member's dues as unpaid at the start of a new year. */
export async function resetAllDues(committeeId: string, committeeSlug: string): Promise<number> {
  const { committeeId: verifiedId } = await requireRosterRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const { count } = await prisma.rosterMember.updateMany({
    where: { committeeId, duesPaid: true },
    data: { duesPaid: false },
  })
  revalidatePath(`/app/${committeeSlug}/members`)
  return count
}

export async function deleteRosterMember(id: string, committeeSlug: string) {
  const { committeeId } = await requireRosterRole(committeeSlug)
  const existing = await prisma.rosterMember.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')
  await prisma.rosterMember.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/members`)
}
