import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/db'
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

  // Verify the requesting user belongs to this committee
  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId: bankAccount.committee.id },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const syncRes = await plaidClient.transactionsSync({
      access_token: bankAccount.plaidAccessToken,
      cursor: bankAccount.syncCursor ?? undefined,
    })

    const { added, modified, removed, next_cursor } = syncRes.data

    // Remove withdrawn transactions
    if (removed.length > 0) {
      await prisma.transaction.deleteMany({
        where: { plaidTransactionId: { in: removed.map((r) => r.transaction_id) } },
      })
    }

    // Upsert added and modified
    for (const tx of [...added, ...modified]) {
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

    // Refresh balance + advance cursor
    const accountsRes = await plaidClient.accountsGet({ access_token: bankAccount.plaidAccessToken })
    const plaidAccount = accountsRes.data.accounts.find(
      (a) => a.account_id === bankAccount.plaidAccountId
    )

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        lastSyncedAt: new Date(),
        syncCursor: next_cursor,
        currentBalance: plaidAccount?.balances.current ?? undefined,
      },
    })

    return NextResponse.json({ added: added.length, modified: modified.length, removed: removed.length })
  } catch (err) {
    console.error('[plaid/sync]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
