import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { REMEMBER_ME_COOKIE, REMEMBERED_MAX_AGE } from '@/lib/session'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Absent marker defaults to remembered — matches pre-existing sessions
  // and any flow that doesn't set the marker (signup, accept-invite). Must
  // match lib/supabase/server.ts's policy so a session-only login doesn't
  // get silently rewritten as persistent on the next refresh here.
  const remembered = request.cookies.get(REMEMBER_ME_COOKIE)?.value !== '0'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: remembered ? REMEMBERED_MAX_AGE : undefined },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // NOTE: no custom type annotation — let @supabase/ssr infer it.
        // Annotating with Record<string, unknown> causes the cookie options
        // to be mangled at runtime, breaking session persistence.
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: nothing between createServerClient and getUser().
  // Any logic here can break session refresh in subtle ways.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public paths — never redirect these
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/quickstart') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/accept-invite') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api/webhooks') ||  // Anedot + Stripe webhooks
    pathname.startsWith('/_next') ||
    pathname.startsWith('/templates')

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // MFA enforcement: a user with a verified TOTP factor must complete the
  // challenge (AAL2) before reaching any authenticated route. Local check —
  // decodes the session JWT and inspects the user's factors, no network call.
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const needsMfa = aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'

    if (needsMfa && !isPublic && !pathname.startsWith('/mfa')) {
      const url = request.nextUrl.clone()
      url.pathname = '/mfa'
      url.search = ''
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }

    // Fully authenticated (or no factor enrolled) users don't need the
    // challenge page
    if (!needsMfa && pathname === '/mfa') {
      const raw = request.nextUrl.searchParams.get('redirectTo') ?? ''
      const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app'
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
  }

  // Logged-in users don't need the login page
  if (user && pathname === '/login') {
    const raw = request.nextUrl.searchParams.get('redirectTo') ?? ''
    const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
