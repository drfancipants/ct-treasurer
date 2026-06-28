import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'

export async function POST(req: NextRequest) {
  const { bankAccountId } = await req.json()

  if (!bankAccountId) {
    return NextResponse.json({ error: 'bankAccountId required' }, { status: 400 })
  }

  try {
    // TODO: look up access_token from DB
    // const bankAccount = await prisma.bankAccount.findUnique({
    //   where: { id: bankAccountId },
    //   select: { plaidAccessToken: true, lastSyncedAt: true },
    // })
    // if (!bankAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    // const access_token = bankAccount.plaidAccessToken

    // Use transactionsSync for efficient incremental updates (cursor-based)
    // const syncRes = await plaidClient.transactionsSync({
    //   access_token,
    //   cursor: bankAccount.syncCursor ?? undefined,
    // })

    // const { added, modified, removed, next_cursor } = syncRes.data

    // Upsert added/modified, mark removed as deleted
    // await prisma.$transaction([
    //   ...added.map(tx =>
    //     prisma.transaction.upsert({
    //       where: { plaidTransactionId: tx.transaction_id },
    //       create: {
    //         bankAccountId,
    //         plaidTransactionId: tx.transaction_id,
    //         amount: tx.amount * -1,  // Plaid: positive = debit, we want positive = deposit
    //         date: tx.date,
    //         description: tx.name,
    //         merchantName: tx.merchant_name ?? undefined,
    //         category: tx.personal_finance_category?.primary ?? undefined,
    //         matchType: 'UNMATCHED',
    //         isReconciled: false,
    //       },
    //       update: {
    //         amount: tx.amount * -1,
    //         description: tx.name,
    //       },
    //     })
    //   ),
    //   prisma.bankAccount.update({
    //     where: { id: bankAccountId },
    //     data: { lastSyncedAt: new Date(), syncCursor: next_cursor },
    //   }),
    // ])

    // return NextResponse.json({ added: added.length, modified: modified.length, removed: removed.length })

    // --- Stub response until DB is wired ---
    return NextResponse.json({ added: 0, modified: 0, removed: 0, message: 'Plaid sync stubbed — wire up DB to enable' })
  } catch (err) {
    console.error('[plaid/sync]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
