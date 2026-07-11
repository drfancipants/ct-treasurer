/**
 * "Remember me" cookie: a plain marker (not a Supabase cookie) that records
 * whether the user chose a persistent or browser-session-only login. Read by
 * the server Supabase client and proxy.ts so every subsequent token refresh
 * re-applies the same cookie lifetime — otherwise a session-only choice would
 * get silently upgraded back to persistent on the next request.
 */
export const REMEMBER_ME_COOKIE = 'remember-me'

/** How long a "remembered" session's cookies live, in seconds (30 days). */
export const REMEMBERED_MAX_AGE = 30 * 24 * 60 * 60

/**
 * `; secure` on HTTPS so the session cookie is never sent over plain HTTP;
 * omitted on http://localhost so dev still works. Client-side only (these
 * cookies are written via document.cookie).
 */
export function secureCookieFlag(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : ''
}

/**
 * Rewrites the just-written Supabase session cookie(s) with the desired
 * Max-Age, using their existing value untouched. Needed because
 * createBrowserClient's own cookieOptions.maxAge doesn't take effect in this
 * package version — only its cookie-writing default (400 days) does. Call
 * right after a client-side sign-in succeeds, before navigating away.
 */
export function applyRememberMeCookiePolicy(rememberMe: boolean) {
  const pairs = document.cookie.split('; ').filter(Boolean)
  for (const pair of pairs) {
    const eq = pair.indexOf('=')
    const name = pair.slice(0, eq)
    if (!name.startsWith('sb-') || !name.includes('-auth-token')) continue
    const value = pair.slice(eq + 1)
    const maxAge = rememberMe ? `; max-age=${REMEMBERED_MAX_AGE}` : ''
    document.cookie = `${name}=${value}; path=/${maxAge}; samesite=lax${secureCookieFlag()}`
  }
}
