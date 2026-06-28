import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Handles Supabase auth callbacks:
 *   - Email magic link sign-ins
 *   - Invitation link completions
 *   - OAuth flows (if added later)
 *
 * Supabase redirects here with a `code` param after the user clicks the link.
 * We exchange it for a session, then redirect to the appropriate page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('redirectTo') ?? '/app'
  const type = searchParams.get('type') // 'invite' | 'magiclink' | undefined

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Invite completions need to go to the accept-invite page to finish setup
      if (type === 'invite') {
        return NextResponse.redirect(`${origin}/accept-invite`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[auth/callback] session exchange error:', error.message)
  }

  // Something went wrong — send back to login with an error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
