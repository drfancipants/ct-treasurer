import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/db'
import { FINANCE_ROLES } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bankAccountId } = await req.json()
  if (!bankAccountId) {
    return NextResponse.json({ error: 'bankAccountId required' }, { status: 400 })
  }

  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: {
      plaidAccessToken: true,
      syncCursor: true,
      plaidAccountId: true,
      committee: { select: { id: true } },
    },
  })

  if (!bankAccount?.plaidAccessToken) {
    return NextResponse.json({ error: 'Account not found or not linked to Plaid' }, { status: 404 })
  }

  // Verify the requesting user has a finance role in this committee
  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId: bankAccount.committee.id, role: { in: FINANCE_ROLES } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // transactionsSync is paginated: a single sync can span multiple pages
    // signalled by has_more. We must drain every page (following next_cursor)
    // before applying anything — otherwise a page of "removed" can land
    // without its matching "added" page, deleting transactions that a later
    // page would have re-added. Advance the stored cursor only to the final
    // page's cursor, and only after all changes are applied.
    type SyncTxn = Awaited<ReturnType<typeof plaidClient.transactionsSync>>['data']['added'][number]
    const added: SyncTxn[] = []
    const modified: SyncTxn[] = []
    const removedIds: string[] = []
    let cursor = bankAccount.syncCursor ?? undefined
    let hasMore = true

    while (hasMore) {
      const syncRes = await plaidClient.transactionsSync({
        access_token: bankAccount.plaidAccessToken,
        cursor,
      })
      added.push(...syncRes.data.added)
      modified.push(...syncRes.data.modified)
      removedIds.push(...syncRes.data.removed.map((r) => r.transaction_id))
      hasMore = syncRes.data.has_more
      cursor = syncRes.data.next_cursor
    }
    const next_cursor = cursor

    // transactionsSync returns transactions for every account on the Item
    // (the whole bank login). This BankAccount row represents one account, so
    // keep only the transactions belonging to it.
    const isThisAccount = (accountId: string) => accountId === bankAccount.plaidAccountId
    const ourAdded = added.filter((tx) => isThisAccount(tx.account_id))
    const ourModified = modified.filter((tx) => isThisAccount(tx.account_id))

    // Remove withdrawn transactions — scoped to this account so a removal on a
    // sibling account can never delete a row here
    if (removedIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { bankAccountId, plaidTransactionId: { in: removedIds } },
      })
    }

    // Upsert added and modified
    for (const tx of [...ourAdded, ...ourModified]) {
      await prisma.transaction.upsert({
        where: { plaidTransactionId: tx.transaction_id },
        create: {
          bankAccountId,
          plaidTransactionId: tx.transaction_id,
          // Plaid: positive amount = debit/expense; we flip so positive = deposit
          amount: tx.amount * -1,
          date: new Date(tx.date),
          description: tx.name,
          merchantName: tx.merchant_name ?? undefined,
          category: tx.personal_finance_category?.primary ?? undefined,
          matchType: 'UNMATCHED',
          isReconciled: false,
        },
        update: {
          amount: tx.amount * -1,
          description: tx.name,
          merchantName: tx.merchant_name ?? undefined,
        },
      })
    }

    // Always advance the cursor — must happen even if balance refresh fails
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { lastSyncedAt: new Date(), syncCursor: next_cursor },
    })

    // Balance refresh is best-effort; a failure here must not roll back the cursor
    try {
      const accountsRes = await plaidClient.accountsGet({ access_token: bankAccount.plaidAccessToken })
      const plaidAccount = accountsRes.data.accounts.find(
        (a) => a.account_id === bankAccount.plaidAccountId
      )
      if (plaidAccount?.balances.current != null) {
        await prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: plaidAccount.balances.current },
        })
      }
    } catch (balanceErr) {
      console.warn('[plaid/sync] balance refresh failed (cursor already advanced):', balanceErr)
    }

    return NextResponse.json({ added: ourAdded.length, modified: ourModified.length, removed: removedIds.length })
  } catch (err) {
    console.error('[plaid/sync]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
