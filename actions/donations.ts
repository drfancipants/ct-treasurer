'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
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
    createdAt: c.createdAt.toISOString(),
  }
}

export async function getContributions(committeeId: string): Promise<Contribution[]> {
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
  },
  committeeSlug: string
): Promise<Contribution> {
  // Find existing contributor by email, or create new
  let contributor = data.contributor.email
    ? await prisma.contributor.findFirst({
        where: { email: data.contributor.email },
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
    },
    include: { contributor: true },
  })

  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return mapContribution(contribution)
}

export async function deleteContribution(id: string, committeeSlug: string) {
  await prisma.contribution.delete({ where: { id } })
  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}

/** Bulk import from Anedot CSV rows — skips duplicates by anedotId */
export async function importContributions(
  committeeId: string,
  rows: ParsedRow[],
  committeeSlug: string
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  for (const row of rows) {
    if (row.isError || row.isDuplicate) { skipped++; continue }

    try {
      // Find or create contributor
      let contributor = row.email
        ? await prisma.contributor.findFirst({ where: { email: row.email } })
        : null

      if (!contributor) {
        contributor = await prisma.contributor.create({
          data: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            address1: row.address1,
            address2: row.address2,
            city: row.city,
            state: row.state || 'CT',
            zip: row.zip,
            employer: row.employer,
            occupation: row.occupation,
          },
        })
      }

      await prisma.contribution.upsert({
        where: { anedotId: row.anedotId ?? `noid_${Date.now()}_${Math.random()}` },
        create: {
          committeeId,
          contributorId: contributor.id,
          amount: row.amount,
          date: new Date(row.date),
          method: row.method,
          source: 'ANEDOT',
          anedotId: row.anedotId,
          isItemized: row.amount >= 50,
        },
        update: {},
      })
      imported++
    } catch {
      skipped++
    }
  }

  revalidatePath(`/app/${committeeSlug}/donations`)
  revalidatePath(`/app/${committeeSlug}/dashboard`)
  return { imported, skipped }
}
