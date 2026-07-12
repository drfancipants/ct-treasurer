'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { plaidClient } from '@/lib/plaid'
import { requireCommitteeMemberById, requireFinanceRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { BankAccount, BankTransaction, TransactionMatchType } from '@/lib/types'

// ─── Mappers ──────────────────────────────────────────────────────────────────

type PrismaBankAccount = {
  id: string; committeeId: string; plaidAccountId: string | null
  name: string; institution: string | null; accountType: string | null
  lastFour: string | null; currentBalance: { toString(): string } | null
  lastSyncedAt: Date | null; createdAt: Date
}

function mapBankAccount(a: PrismaBankAccount): BankAccount {
  return {
    id: a.id,
    committeeId: a.committeeId,
    plaidAccountId: a.plaidAccountId ?? undefined,
    name: a.name,
    institution: a.institution ?? '',
    accountType: a.accountType ?? '',
    lastFour: a.lastFour ?? '',
    currentBalance: a.currentBalance ? Number(a.currentBalance.toString()) : 0,
    lastSyncedAt: a.lastSyncedAt?.toISOString(),
    createdAt: a.createdAt.toISOString(),
  }
}

type PrismaTransaction = {
  id: string; bankAccountId: string; plaidTransactionId: string | null
  amount: { toString(): string }; date: Date; description: string
  merchantName: string | null; category: string | null; matchType: string
  matchedContributionId: string | null; matchedExpenditureId: string | null
  matchedCommitteeContributionId: string | null
  isReconciled: boolean; createdAt: Date
}

function mapTransaction(t: PrismaTransaction): BankTransaction {
  return {
    id: t.id,
    bankAccountId: t.bankAccountId,
    plaidTransactionId: t.plaidTransactionId ?? undefined,
    amount: Number(t.amount.toString()),
    date: t.date.toISOString().split('T')[0],
    description: t.description,
    merchantName: t.merchantName ?? undefined,
    category: t.category ?? undefined,
    matchType: t.matchType as TransactionMatchType,
    matchedContributionId: t.matchedContributionId ?? undefined,
    matchedExpenditureId: t.matchedExpenditureId ?? undefined,
    matchedCommitteeContributionId: t.matchedCommitteeContributionId ?? undefined,
    isReconciled: t.isReconciled,
    createdAt: t.createdAt.toISOString(),
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getBankAccounts(committeeId: string): Promise<BankAccount[]> {
  await requireCommitteeMemberById(committeeId)
  const accounts = await prisma.bankAccount.findMany({
    where: { committeeId },
    orderBy: { createdAt: 'asc' },
  })
  return accounts.map(mapBankAccount)
}

export async function getTransactions(bankAccountIds: string[]): Promise<BankTransaction[]> {
  if (bankAccountIds.length === 0) return []
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // Scope to accounts the caller actually has access to
  const txns = await prisma.transaction.findMany({
    where: {
      bankAccountId: { in: bankAccountIds },
      bankAccount: { committee: { memberships: { some: { userId: user.id } } } },
    },
    orderBy: { date: 'desc' },
  })
  return txns.map(mapTransaction)
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function removeBankAccount(accountId: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, committeeId } })
  if (!account) throw new Error('Forbidden')

  // Delete the row and decide whether this was the Item's last account inside
  // one transaction, guarded by a per-Item advisory lock. Without the lock,
  // two concurrent removals of accounts on the same Plaid Item each run their
  // sibling count while the other's row still exists — both see siblings > 0,
  // both skip itemRemove, and the Item is orphaned (still billing at Plaid).
  // The xact-scoped advisory lock serializes the delete+count per Item and is
  // released on commit, so it is safe under transaction-mode connection
  // pooling. Rows without a Plaid Item (should not occur) just skip the lock.
  const wasLastAccount = await prisma.$transaction(async (tx) => {
    if (account.plaidItemId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${account.plaidItemId}))`
    }
    await tx.transaction.deleteMany({ where: { bankAccountId: accountId } })
    await tx.bankAccount.delete({ where: { id: accountId } })
    if (!account.plaidItemId) return false
    const siblings = await tx.bankAccount.count({ where: { plaidItemId: account.plaidItemId } })
    return siblings === 0
  })

  // Revoke the Plaid Item once its last linked account is gone — an Item left
  // active at Plaid keeps billing monthly and keeps the access grant alive.
  // Best-effort: local removal already committed, so a Plaid failure (network,
  // or the Item already dead because it was revoked at the bank) must not throw.
  if (wasLastAccount && account.plaidAccessToken) {
    try {
      await plaidClient.itemRemove({ access_token: account.plaidAccessToken })
    } catch (err) {
      console.error('[bank/removeBankAccount] plaid itemRemove failed — item may be orphaned at Plaid:', err)
    }
  }

  revalidatePath(`/app/${committeeSlug}/bank`)
}

/** Choose which linked account's balance the dashboard shows. */
export async function setDashboardBankAccount(accountId: string, committeeSlug: string) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, committeeId } })
  if (!account) throw new Error('Forbidden')

  await prisma.committee.update({
    where: { id: committeeId },
    data: { dashboardBankAccountId: accountId },
  })
  revalidatePath(`/app/${committeeSlug}/dashboard`)
}

export async function reconcileTransaction(
  transactionId: string,
  matchType: 'CONTRIBUTION' | 'EXPENDITURE' | 'COMMITTEE_CONTRIBUTION' | 'IGNORED',
  matchedId: string | undefined,
  committeeSlug: string
) {
  const { committeeId } = await requireFinanceRole(committeeSlug)
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, bankAccount: { committeeId } },
  })
  if (!tx) throw new Error('Forbidden')

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      matchType,
      isReconciled: matchType !== 'IGNORED',
      matchedContributionId: matchType === 'CONTRIBUTION' ? (matchedId ?? null) : null,
      matchedExpenditureId: matchType === 'EXPENDITURE' ? (matchedId ?? null) : null,
      matchedCommitteeContributionId: matchType === 'COMMITTEE_CONTRIBUTION' ? (matchedId ?? null) : null,
    },
  })
  revalidatePath(`/app/${committeeSlug}/bank`)
}
