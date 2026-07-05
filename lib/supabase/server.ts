import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { REMEMBER_ME_COOKIE, REMEMBERED_MAX_AGE } from '@/lib/session'

/**
 * Server-side Supabase client.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Uses the anon key + row-level security.
 */
export async function createClient() {
  const cookieStore = await cookies()
  // Absent marker defaults to remembered — matches pre-existing sessions
  // and any flow that doesn't set the marker (signup, accept-invite).
  const remembered = cookieStore.get(REMEMBER_ME_COOKIE)?.value !== '0'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: remembered ? REMEMBERED_MAX_AGE : undefined },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies can't be set.
            // Middleware handles session refresh, so this is safe to ignore.
          }
        },
      },
    }
  )
}

/**
 * Admin Supabase client.
 * Uses the service role key — bypasses RLS.
 * Only use in trusted server-side contexts (API routes, never client).
 */
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
