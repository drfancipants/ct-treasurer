'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import { syncRosterContributorLinks } from '@/lib/roster-links'
import type { Contribution, PaymentMethod, ContributionSource } from '@/lib/types'
import type { ParsedRow } from '@/lib/anedot-csv'

type ContributionWithContributor = {
  id: string
  committeeId: string
  amount: { toString(): string }
  date: Date
  method: string
  checkNumber: string | null
  memo: string | null
  source: string
  anedotId: string | null
  isItemized: boolean
  filedAt: Date | null
  eventId: string | null
  createdAt: Date
  contributor: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    address1: string
    address2: string | null
    city: string
    state: string
    zip: string
    employer: string | null
    occupation: string | null
  }
}

function mapContribution(c: ContributionWithContributor): Contribution {
  return {
    id: c.id,
    committeeId: c.committeeId,
    contributor: {
      id: c.contributor.id,
      firstName: c.contributor.firstName,
      lastName: c.contributor.lastName,
      email: c.contributor.email ?? undefined,
      phone: c.contributor.phone ?? undefined,
      address1: c.contributor.address1,
      address2: c.contributor.address2 ?? undefined,
      city: c.contributor.city,
      state: c.contributor.state,
      zip: c.contributor.zip,
      employer: c.contributor.employer ?? undefined,
      occupation: c.contributor.occupation ?? undefined,
    },
    amount: Number(c.amount.toString()),
    date: c.date.toISOString().split('T')[0],
    method: c.method as PaymentMethod,
    checkNumber: c.checkNumber ?? undefined,
    memo: c.memo ?? undefined,
    source: c.source as ContributionSource,
    anedotId: c.anedotId ?? undefined,
    isItemized: c.isItemized,
    filedAt: c.filedAt?.toISOString() ?? undefined,
    eventId: c.eventId ?? undefined,
    createdAt: c.createdAt.toISOString(),
  }
}

export async function getContributions(committeeId: string): Promise<Contribution[]> {
  await requireCommitteeMemberById(committeeId)
  const rows = await prisma.contribution.findMany({
    where: { committeeId },
    include: { contributor: true },
    orderBy: { date: 'desc' },
  })
  return rows.map(mapContribution)
}

export async function createContribution(
  committeeId: string,
  data: {
    contributor: {
      firstName: string
      lastName: string
      email?: string
      address1: string
      address2?: string
      city: string
      state: string
      zip: string
      employer?: string
      occupation?: string
    }
    amount: number
    date: string
    method: PaymentMethod
    checkNumber?: string
    memo?: string
    isItemized: boolean
    eventId?: string
  },
  committeeSlug: string
): Promise<Contribution> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  // Find existing contributor by email (case-insensitive), or create new
  let contributor = data.contributor.email
    ? await prisma.contributor.findFirst({
        where: { email: { equals: data.contributor.email, mode: 'insensitive' } },
      })
    : null

  if (!contributor) {
    contributor = await prisma.contributor.create({
      data: {
        firstName: data.contributor.firstName,
        lastName: data.contributor.lastName,
        email: data.contributor.email,
        address1: data.contributor.address1,
        address2: data.contributor.address2,
        city: data.contributor.city,
        state: data.contributor.state,
        zip: data.contributor.zip,
        employer: data.contributor.employer,
        occupation: data.contributor.occupation,
      },
    })
  }

  const contribution = await prisma.contribution.create({
    data: {
      committeeId,
      contributorId: contributor.id,
      amount: data.amount,
      date: new Date(data.date),
      method: data.method,
      checkNumber: data.checkNumber,
      memo: data.memo,
      source: 'MANUAL',
      isItemized: data.isItemized,
      eventId,
    },
    include: { contributor: true },
  })

  // A new donation may belong to a roster member — link them up
  await syncRosterContributorLinks(committeeId)

  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapContribution(contribution)
}

/** Validate an event belongs to the committee; returns null if unset. */
async function resolveEventId(eventId: string | undefined, committeeId: string): Promise<string | null> {
  if (!eventId) return null
  const event = await prisma.event.findFirst({ where: { id: eventId, committeeId }, select: { id: true } })
  if (!event) throw new Error('Event not found for this committee')
  return event.id
}

export async function updateContribution(
  contributionId: string,
  contributorId: string,
  data: {
    contributor: {
      firstName: string
      lastName: string
      email?: string
      address1: string
      address2?: string
      city: string
      state: string
      zip: string
      employer?: string
      occupation?: string
    }
    amount: number
    date: string
    method: PaymentMethod
    checkNumber?: string
    memo?: string
    isItemized: boolean
    eventId?: string
  },
  committeeSlug: string
): Promise<Contribution> {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.contribution.findFirst({ where: { id: contributionId, committeeId } })
  if (!existing || existing.contributorId !== contributorId) throw new Error('Forbidden')
  const eventId = await resolveEventId(data.eventId, committeeId)

  // Update contributor first so the subsequent contribution fetch returns fresh data
  await prisma.contributor.update({
    where: { id: contributorId },
    data: {
      firstName: data.contributor.firstName,
      lastName: data.contributor.lastName,
      email: data.contributor.email ?? null,
      address1: data.contributor.address1,
      address2: data.contributor.address2 ?? null,
      city: data.contributor.city,
      state: data.contributor.state,
      zip: data.contributor.zip,
      employer: data.contributor.employer ?? null,
      occupation: data.contributor.occupation ?? null,
    },
  })

  const contribution = await prisma.contribution.update({
    where: { id: contributionId },
    data: {
      amount: data.amount,
      date: new Date(data.date),
      method: data.method,
      checkNumber: data.checkNumber ?? null,
      memo: data.memo ?? null,
      isItemized: data.isItemized,
      eventId,
    },
    include: { contributor: true },
  })

  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapContribution(contribution)
}

export async function deleteContribution(id: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const existing = await prisma.contribution.findFirst({ where: { id, committeeId } })
  if (!existing) throw new Error('Forbidden')

  await prisma.contribution.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}

/** Bulk import from Anedot CSV rows — skips duplicates by anedotId */
export async function importContributions(
  committeeId: string,
  rows: ParsedRow[],
  committeeSlug: string
): Promise<{ imported: number; skipped: number; contributions: Contribution[] }> {
  const { committeeId: verifiedId } = await requireFinanceRole(committeeSlug)
  if (verifiedId !== committeeId) throw new Error('Forbidden')

  const validRows = rows.filter(r => !r.isError && !r.isDuplicate)
  let extraSkipped = rows.length - validRows.length

  if (validRows.length === 0) {
    return { imported: 0, skipped: extraSkipped, contributions: [] }
  }

  // 1. Batch-load existing contributors by email (one query instead of N).
  // All email keying is lowercased so "Jane@X.com" and "jane@x.com" resolve
  // to the same contributor instead of creating a duplicate.
  const emails = [...new Set(validRows.map(r => r.email?.toLowerCase()).filter(Boolean))] as string[]
  const existingContributors = await prisma.contributor.findMany({
    where: { email: { in: emails, mode: 'insensitive' } },
    select: { id: true, email: true },
  })
  const emailToId = new Map(existingContributors.map(c => [c.email!.toLowerCase(), c.id]))

  // 2. Create missing contributors (only new donors, not the full list)
  const missingEmails = emails.filter(e => !emailToId.has(e))
  const emailToRow = new Map(validRows.filter(r => r.email).map(r => [r.email!.toLowerCase(), r]))
  for (const email of missingEmails) {
    const r = emailToRow.get(email)!
    try {
      const c = await prisma.contributor.create({
        data: {
          firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
          address1: r.address1, address2: r.address2,
          city: r.city, state: r.state || 'CT', zip: r.zip,
          employer: r.employer, occupation: r.occupation,
        },
        select: { id: true },
      })
      emailToId.set(email, c.id)
    } catch { extraSkipped++ }
  }

  // 3. Rows without email — create contributors individually (no dedup key)
  const noEmailRows = validRows.filter(r => !r.email)
  const noEmailIds: string[] = []
  for (const r of noEmailRows) {
    try {
      const c = await prisma.contributor.create({
        data: {
          firstName: r.firstName, lastName: r.lastName, phone: r.phone,
          address1: r.address1, address2: r.address2,
          city: r.city, state: r.state || 'CT', zip: r.zip,
          employer: r.employer, occupation: r.occupation,
        },
        select: { id: true },
      })
      noEmailIds.push(c.id)
    } catch { noEmailIds.push(''); extraSkipped++ }
  }

  // 4. Build contribution records and batch-insert (skipDuplicates handles anedotId conflicts)
  type ContributionInput = { committeeId: string; contributorId: string; amount: number; date: Date; method: PaymentMethod; checkNumber: string | null; memo: string | null; source: 'ANEDOT'; anedotId: string | null; isItemized: boolean }
  const contributionData: ContributionInput[] = []
  for (const r of validRows.filter(r => r.email)) {
    const contributorId = emailToId.get(r.email!.toLowerCase())
    if (!contributorId) continue
    contributionData.push({
      committeeId, contributorId, amount: r.amount,
      date: new Date(r.date), method: r.method,
      checkNumber: r.checkNumber ?? null, memo: r.memo ?? null,
      source: 'ANEDOT', anedotId: r.anedotId ?? null,
      isItemized: r.amount >= 50,
    })
  }
  let noEmailIdx = 0
  for (const r of noEmailRows) {
    const contributorId = noEmailIds[noEmailIdx++]
    if (!contributorId) continue
    contributionData.push({
      committeeId, contributorId, amount: r.amount,
      date: new Date(r.date), method: r.method,
      checkNumber: r.checkNumber ?? null, memo: r.memo ?? null,
      source: 'ANEDOT', anedotId: r.anedotId ?? null,
      isItemized: r.amount >= 50,
    })
  }

  // Insert and return the created rows (with real DB IDs) in one statement,
  // so the client state stays consistent without relying on timestamps
  const created = await prisma.contribution.createManyAndReturn({
    data: contributionData,
    skipDuplicates: true,
    include: { contributor: true },
  })

  // Imported donations may belong to roster members — link them up
  await syncRosterContributorLinks(committeeId)

  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return {
    imported: created.length,
    skipped: extraSkipped + (contributionData.length - created.length),
    contributions: created.map(mapContribution),
  }
}
