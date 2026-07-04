'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import { syncRosterContributorLinks } from '@/lib/roster-links'
import type { Contribution, PaymentMethod, ContributionSource } from '@/lib/types'
import type { ParsedRow } from '@/lib/anedot-csv'

/**
 * Next.js redacts thrown-error messages from Server Actions in production
 * unless the action itself catches and rethrows — an unhandled Prisma error
 * would otherwise reach the client as an opaque digest with no detail. Maps
 * common Prisma error conditions to a message that's actually useful without
 * leaking raw DB/query internals (file paths, query text) to the client —
 * those still go to the server log via console.error.
 */
function friendlyImportError(err: unknown, context: string): Error {
  console.error(`[importContributions] ${context}:`, err)

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2000') {
      return new Error(`${context}: a field value is too long — check for an unusually long name, address, or note.`)
    }
    if (err.code === 'P2002') {
      return new Error(`${context}: a duplicate entry conflict occurred.`)
    }
    return new Error(`${context}: database error (${err.code}).`)
  }

  // Raw DB errors the query engine couldn't map to a known Prisma code
  // (e.g. a Postgres constraint violation) surface as PrismaClientUnknownRequestError,
  // whose .message is a full multi-line dump including file paths and query
  // text — never show that raw text to the client. Pattern-match the
  // Postgres error text for the cases worth calling out specifically.
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const raw = err.message
    if (raw.includes('numeric field overflow')) {
      return new Error(`${context}: an amount has too many digits (check for a typo, e.g. an extra zero).`)
    }
    return new Error(`${context}: unexpected database error. Check the CSV for unusual values.`)
  }

  const message = err instanceof Error ? err.message : String(err)
  // Only pass through short, single-line messages (e.g. our own thrown
  // "Forbidden" or "Event not found") — anything longer is likely an
  // unrelated internal error we shouldn't echo verbatim to the client.
  if (message.length < 200 && !message.includes('\n')) {
    return new Error(`${context}: ${message}`)
  }
  return new Error(`${context}: unexpected error.`)
}

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
  processedDate: Date | null
  netAmount: { toString(): string } | null
  processingFee: { toString(): string } | null
  donorCoveredFees: boolean
  cardType: string | null
  cardLast4: string | null
  isRecurring: boolean
  campaign: string | null
  isStateContractor: boolean
  contractorBranch: string | null
  isLobbyist: boolean
  createdAt: Date
  contributor: {
    id: string
    firstName: string
    middleInitial: string | null
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
      middleInitial: c.contributor.middleInitial ?? undefined,
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
    processedDate: c.processedDate?.toISOString().split('T')[0],
    netAmount: c.netAmount ? Number(c.netAmount.toString()) : undefined,
    processingFee: c.processingFee ? Number(c.processingFee.toString()) : undefined,
    donorCoveredFees: c.donorCoveredFees,
    cardType: c.cardType ?? undefined,
    cardLast4: c.cardLast4 ?? undefined,
    isRecurring: c.isRecurring,
    campaign: c.campaign ?? undefined,
    isStateContractor: c.isStateContractor,
    contractorBranch: c.contractorBranch ?? undefined,
    isLobbyist: c.isLobbyist,
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

interface ContributionFieldsInput {
  amount: number
  date: string
  method: PaymentMethod
  checkNumber?: string
  memo?: string
  isItemized: boolean
  eventId?: string
  isStateContractor?: boolean
  contractorBranch?: string
  isLobbyist?: boolean
}

interface ContributorFieldsInput {
  firstName: string
  middleInitial?: string
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

export async function createContribution(
  committeeId: string,
  data: ContributionFieldsInput & { contributor: ContributorFieldsInput },
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
        middleInitial: data.contributor.middleInitial,
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
      isStateContractor: data.isStateContractor ?? false,
      contractorBranch: data.isStateContractor ? (data.contractorBranch ?? null) : null,
      isLobbyist: data.isLobbyist ?? false,
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
  data: ContributionFieldsInput & { contributor: ContributorFieldsInput },
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
      middleInitial: data.contributor.middleInitial ?? null,
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
      isStateContractor: data.isStateContractor ?? false,
      contractorBranch: data.isStateContractor ? (data.contractorBranch ?? null) : null,
      isLobbyist: data.isLobbyist ?? false,
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

  // 1. Batch-load existing contributors by email (one query instead of N).
  // All email keying is lowercased so "Jane@X.com" and "jane@x.com" resolve
  // to the same contributor instead of creating a duplicate. Duplicate rows
  // are included so their donor detail can backfill existing records.
  const allRows = rows.filter(r => !r.isError)
  const emails = [...new Set(allRows.map(r => r.email?.toLowerCase()).filter(Boolean))] as string[]
  const existingContributors = emails.length > 0
    ? await prisma.contributor.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: {
          id: true, email: true, employer: true, occupation: true,
          phone: true, middleInitial: true, address1: true, city: true, zip: true,
        },
      })
    : []
  const emailToId = new Map(existingContributors.map(c => [c.email!.toLowerCase(), c.id]))

  // Backfill existing contributors' missing fields from the CSV — donors
  // created by earlier imports or the webhook often lack employer/occupation
  // (SEEC-required), which only the ledger export carries. Fill-when-empty
  // only; existing values are never overwritten. This must run even when
  // every row is a duplicate — that's exactly the re-import-to-heal case.
  let backfilled = 0
  const rowByEmail = new Map<string, ParsedRow>()
  for (const r of allRows) {
    if (!r.email) continue
    const key = r.email.toLowerCase()
    if (!rowByEmail.has(key) || (r.employer && r.occupation)) rowByEmail.set(key, r)
  }
  for (const c of existingContributors) {
    const r = rowByEmail.get(c.email!.toLowerCase())
    if (!r) continue
    const patch: Record<string, string> = {}
    if (!c.employer && r.employer) patch.employer = r.employer
    if (!c.occupation && r.occupation) patch.occupation = r.occupation
    if (!c.phone && r.phone) patch.phone = r.phone
    if (!c.middleInitial && r.middleInitial) patch.middleInitial = r.middleInitial
    if (!c.address1 && r.address1) patch.address1 = r.address1
    if (!c.city && r.city) patch.city = r.city
    if (!c.zip && r.zip) patch.zip = r.zip
    if (Object.keys(patch).length > 0) {
      await prisma.contributor.update({ where: { id: c.id }, data: patch })
      backfilled++
    }
  }

  // Duplicate rows still carry value: webhook-created donations have no fee
  // detail (Anedot doesn't send it), so a ledger re-import backfills those
  // fields onto the existing record instead of discarding them
  const enrichable = rows.filter(
    r => r.isDuplicate && r.anedotId && (r.netAmount != null || r.processingFee != null)
  )
  for (const r of enrichable) {
    try {
      await prisma.contribution.updateMany({
        where: { anedotId: r.anedotId!, committeeId, processingFee: null },
        data: {
          processedDate: r.processedDate ? new Date(r.processedDate) : null,
          netAmount: r.netAmount ?? null,
          processingFee: r.processingFee ?? null,
          donorCoveredFees: r.donorCoveredFees ?? false,
          cardType: r.cardType ?? null,
          cardLast4: r.cardLast4 ?? null,
        },
      })
    } catch (err) {
      throw friendlyImportError(err, `Failed to update processing-fee detail for row ${r.rowIndex}`)
    }
  }

  if (validRows.length === 0) {
    if (enrichable.length > 0 || backfilled > 0) revalidatePath(`/app/${committeeSlug}/donations`)
    return { imported: 0, skipped: extraSkipped, contributions: [] }
  }

  // Contributors created during this call — tracked so a failure in the
  // final batch insert (step 4) can be compensated by deleting them, instead
  // of leaving orphaned Contributor rows with no Contribution behind them.
  const newContributorIds: string[] = []

  // 2. Create missing contributors (only new donors, not the full list).
  // Sourced from validRows only — `emails`/`emailToId` also cover duplicate
  // rows (for the backfill above), which don't need a contributor created.
  const emailToRow = new Map(validRows.filter(r => r.email).map(r => [r.email!.toLowerCase(), r]))
  const missingEmails = [...emailToRow.keys()].filter(e => !emailToId.has(e))
  for (const email of missingEmails) {
    const r = emailToRow.get(email)!
    try {
      const c = await prisma.contributor.create({
        data: {
          firstName: r.firstName, middleInitial: r.middleInitial, lastName: r.lastName,
          email: r.email, phone: r.phone,
          address1: r.address1, address2: r.address2,
          city: r.city, state: r.state || 'CT', zip: r.zip,
          employer: r.employer, occupation: r.occupation,
        },
        select: { id: true },
      })
      emailToId.set(email, c.id)
      newContributorIds.push(c.id)
    } catch { extraSkipped++ }
  }

  // 3. Rows without email — create contributors individually (no dedup key)
  const noEmailRows = validRows.filter(r => !r.email)
  const noEmailIds: string[] = []
  for (const r of noEmailRows) {
    try {
      const c = await prisma.contributor.create({
        data: {
          firstName: r.firstName, middleInitial: r.middleInitial, lastName: r.lastName, phone: r.phone,
          address1: r.address1, address2: r.address2,
          city: r.city, state: r.state || 'CT', zip: r.zip,
          employer: r.employer, occupation: r.occupation,
        },
        select: { id: true },
      })
      noEmailIds.push(c.id)
      newContributorIds.push(c.id)
    } catch { noEmailIds.push(''); extraSkipped++ }
  }

  // 4. Build contribution records and batch-insert (skipDuplicates handles anedotId conflicts)
  const toContributionData = (r: ParsedRow, contributorId: string) => ({
    committeeId, contributorId, amount: r.amount,
    date: new Date(r.date), method: r.method,
    checkNumber: r.checkNumber ?? null, memo: r.memo ?? null,
    source: 'ANEDOT' as const, anedotId: r.anedotId ?? null,
    isItemized: r.amount >= 50,
    processedDate: r.processedDate ? new Date(r.processedDate) : null,
    netAmount: r.netAmount ?? null,
    processingFee: r.processingFee ?? null,
    donorCoveredFees: r.donorCoveredFees ?? false,
    cardType: r.cardType ?? null,
    cardLast4: r.cardLast4 ?? null,
    isRecurring: r.isRecurring ?? false,
    campaign: r.campaign ?? null,
    isStateContractor: r.isStateContractor ?? false,
    contractorBranch: r.contractorBranch ?? null,
    isLobbyist: r.isLobbyist ?? false,
  })
  const contributionData: ReturnType<typeof toContributionData>[] = []
  for (const r of validRows.filter(r => r.email)) {
    const contributorId = emailToId.get(r.email!.toLowerCase())
    if (!contributorId) continue
    contributionData.push(toContributionData(r, contributorId))
  }
  let noEmailIdx = 0
  for (const r of noEmailRows) {
    const contributorId = noEmailIds[noEmailIdx++]
    if (!contributorId) continue
    contributionData.push(toContributionData(r, contributorId))
  }

  // Insert and return the created rows (with real DB IDs) in one statement,
  // so the client state stays consistent without relying on timestamps
  let created
  try {
    created = await prisma.contribution.createManyAndReturn({
      data: contributionData,
      skipDuplicates: true,
      include: { contributor: true },
    })
  } catch (err) {
    // Roll back the contributors created above — without this, a failed
    // batch insert would leave orphaned Contributor rows with no
    // Contribution behind them, even though the error says nothing was saved
    if (newContributorIds.length > 0) {
      await prisma.contributor.deleteMany({ where: { id: { in: newContributorIds } } }).catch((cleanupErr) => {
        console.error('[importContributions] Failed to roll back orphaned contributors:', cleanupErr)
      })
    }
    throw friendlyImportError(err, `Failed to save ${contributionData.length} donation${contributionData.length !== 1 ? 's' : ''}`)
  }

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
