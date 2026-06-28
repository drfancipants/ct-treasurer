import { NextRequest, NextResponse } from 'next/server'
import { CountryCode, Products } from 'plaid'
import { plaidClient } from '@/lib/plaid'

export async function POST(req: NextRequest) {
  const { committeeId } = await req.json()

  if (!committeeId) {
    return NextResponse.json({ error: 'committeeId required' }, { status: 400 })
  }

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json(
      { error: 'Plaid credentials not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local' },
      { status: 503 }
    )
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        // TODO: replace with real authenticated user ID
        client_user_id: `committee_${committeeId}`,
      },
      client_name: 'CT Committee Treasurer Suite',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      // Webhook called when new transactions are available
      webhook: process.env.PLAID_WEBHOOK_URL,
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (err) {
    console.error('[plaid/link-token]', err)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
