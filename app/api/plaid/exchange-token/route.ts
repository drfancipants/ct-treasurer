import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { public_token, committeeId } = await req.json()
  if (!public_token || !committeeId) {
    return NextResponse.json({ error: 'public_token and committeeId required' }, { status: 400 })
  }

  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = exchangeRes.data

    const accountsRes = await plaidClient.accountsGet({ access_token })
    const { accounts, item } = accountsRes.data

    await Promise.all(
      accounts.map((account) =>
        prisma.bankAccount.upsert({
          where: { plaidAccountId: account.account_id },
          create: {
            committeeId,
            plaidAccountId: account.account_id,
            plaidItemId: item_id,
            plaidAccessToken: access_token,
            name: account.name,
            institution: item.institution_id ?? 'Unknown',
            accountType: account.type,
            lastFour: account.mask ?? '',
            currentBalance: account.balances.current ?? 0,
          },
          update: {
            currentBalance: account.balances.current ?? 0,
          },
        })
      )
    )

    console.log(`[plaid/exchange-token] Linked ${accounts.length} account(s) for committee ${committeeId}`)
    return NextResponse.json({ linked: accounts.length })
  } catch (err) {
    console.error('[plaid/exchange-token]', err)
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 })
  }
}
