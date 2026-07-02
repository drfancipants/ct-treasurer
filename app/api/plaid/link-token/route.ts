import { NextRequest, NextResponse } from 'next/server'
import { CountryCode, Products } from 'plaid'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/db'
import { FINANCE_ROLES } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { committeeId } = await req.json()
  if (!committeeId) {
    return NextResponse.json({ error: 'committeeId required' }, { status: 400 })
  }

  // Linking a bank account is a finance-role operation
  const membership = await prisma.committeeMembership.findFirst({
    where: { userId: user.id, committeeId, role: { in: FINANCE_ROLES } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json(
      { error: 'Plaid credentials not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local' },
      { status: 503 }
    )
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'CT Committee Treasurer Suite',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL,
      // Pull the maximum transaction history (24 months) instead of Plaid's
      // 90-day default. Set per-Item at link time, so an already-linked
      // account must be reconnected to widen its window.
      transactions: { days_requested: 730 },
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (err) {
    console.error('[plaid/link-token]', err)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
