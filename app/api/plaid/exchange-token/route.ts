import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'

export async function POST(req: NextRequest) {
  const { public_token, committeeId } = await req.json()

  if (!public_token || !committeeId) {
    return NextResponse.json({ error: 'public_token and committeeId required' }, { status: 400 })
  }

  try {
    // Exchange the short-lived public_token for a permanent access_token
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = exchangeRes.data

    // Fetch account details to display to the user
    const accountsRes = await plaidClient.accountsGet({ access_token })
    const accounts = accountsRes.data.accounts

    // TODO: store in database
    // For each Plaid account, upsert a BankAccount record:
    //
    // await Promise.all(accounts.map(account =>
    //   prisma.bankAccount.upsert({
    //     where: { plaidAccountId: account.account_id },
    //     create: {
    //       committeeId,
    //       plaidAccountId: account.account_id,
    //       plaidItemId: item_id,
    //       plaidAccessToken: access_token,  // encrypt at rest in production!
    //       name: account.name,
    //       institution: accountsRes.data.item.institution_id ?? 'Unknown',
    //       accountType: account.type,
    //       lastFour: account.mask ?? '',
    //       currentBalance: account.balances.current ?? 0,
    //       availableBalance: account.balances.available ?? undefined,
    //     },
    //     update: {
    //       currentBalance: account.balances.current ?? 0,
    //       availableBalance: account.balances.available ?? undefined,
    //     },
    //   })
    // ))

    console.log(`[plaid/exchange-token] Linked ${accounts.length} account(s) for committee ${committeeId}`)

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        plaidAccountId: a.account_id,
        name: a.name,
        type: a.type,
        lastFour: a.mask,
        balance: a.balances.current,
      })),
    })
  } catch (err) {
    console.error('[plaid/exchange-token]', err)
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 })
  }
}
