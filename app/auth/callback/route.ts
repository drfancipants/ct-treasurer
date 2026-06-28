import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('redirectTo') ?? '/app'
  const type = searchParams.get('type') // 'invite' | 'magiclink' | undefined

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Ensure a public-schema User row exists. The invite flow creates it at
      // invite time; self-serve signup only has an auth.users row until here.
      await prisma.user.upsert({
        where: { id: data.user.id },
        create: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name ?? null,
        },
        update: {},
      })

      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/accept-invite`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[auth/callback] session exchange error:', error?.message)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
