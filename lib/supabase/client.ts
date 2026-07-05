import { createBrowserClient } from '@supabase/ssr'

// NOTE: createBrowserClient's `cookieOptions.maxAge` is a no-op in this
// package version — it's only wired through on the server client. "Remember
// me" is enforced instead by rewriting the cookie's Max-Age after sign-in;
// see applyRememberMeCookiePolicy in lib/session.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
