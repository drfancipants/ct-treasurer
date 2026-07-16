/**
 * Platform admin toolbox — operator scripts for the support tasks the app
 * deliberately has no UI for. See scripts/README.md.
 *
 *   npm run admin -- list-committees
 *   npm run admin -- list-users
 *   npm run admin -- unlock-mfa <email> [--delete]
 *   npm run admin -- set-subscription <slug> <status> [--trial-ends=YYYY-MM-DD]
 *
 * Targets the local database by default. Pass --prod to run against
 * production using credentials from .env.prod; mutations in prod also
 * require --yes.
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient, SubscriptionStatus } from '@prisma/client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const USAGE = `Usage: npm run admin -- <command> [args] [--prod] [--yes]

Commands:
  list-committees                  committees with status, members, last activity
  list-users                       app users with memberships, sign-in, and MFA state
  unlock-mfa <email> [--delete]    list a user's TOTP factors; --delete removes them
                                   (the only recovery path for a locked-out user)
  set-subscription <slug> <status> [--trial-ends=YYYY-MM-DD]
                                   set subscriptionStatus (${Object.values(SubscriptionStatus).join(' | ')})

Flags:
  --prod   target production via .env.prod (default: local .env.local/.env)
  --yes    required for mutating commands when --prod is set
`

type Ctx = {
  prisma: PrismaClient
  supabase: SupabaseClient
  prod: boolean
  yes: boolean
}

function die(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

// ─── Env loading ─────────────────────────────────────────────────────────────

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const REQUIRED_KEYS = ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

function loadEnv(prod: boolean): Record<string, string> {
  const root = resolve(__dirname, '..')
  let env: Record<string, string> = {}

  if (prod) {
    const prodPath = resolve(root, '.env.prod')
    if (!existsSync(prodPath)) {
      die(
        `.env.prod not found. Create it (it is gitignored) with the production values of:\n` +
          REQUIRED_KEYS.map((k) => `  ${k}`).join('\n') +
          `\nVercel stores these as Sensitive (unpullable) vars — copy them from the Supabase dashboard instead. See scripts/README.md.`
      )
    }
    env = parseEnvFile(prodPath)
  } else {
    for (const file of ['.env', '.env.local']) {
      const path = resolve(root, file)
      if (existsSync(path)) env = { ...env, ...parseEnvFile(path) }
    }
  }

  const missing = REQUIRED_KEYS.filter((k) => !env[k])
  if (missing.length > 0) {
    die(`missing ${missing.join(', ')} in ${prod ? '.env.prod' : '.env.local/.env'}`)
  }
  return env
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(unparseable url)'
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function listCommittees(ctx: Ctx) {
  const [committees, lastContributions, lastExpenditures] = await Promise.all([
    ctx.prisma.committee.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { memberships: true, contributions: true, expenditures: true } },
      },
    }),
    ctx.prisma.contribution.groupBy({ by: ['committeeId'], _max: { date: true } }),
    ctx.prisma.expenditure.groupBy({ by: ['committeeId'], _max: { date: true } }),
  ])

  const lastActivity = new Map<string, Date>()
  for (const row of [...lastContributions, ...lastExpenditures]) {
    const date = row._max.date
    if (!date) continue
    const current = lastActivity.get(row.committeeId)
    if (!current || date > current) lastActivity.set(row.committeeId, date)
  }

  console.table(
    committees.map((c) => ({
      slug: c.slug,
      name: c.name,
      type: c.type,
      subscription: c.subscriptionStatus ?? '—',
      trialEnds: c.trialEndsAt?.toISOString().slice(0, 10) ?? '—',
      members: c._count.memberships,
      contribs: c._count.contributions,
      expends: c._count.expenditures,
      lastActivity: lastActivity.get(c.id)?.toISOString().slice(0, 10) ?? '—',
      created: c.createdAt.toISOString().slice(0, 10),
    }))
  )
  console.log(`${committees.length} committee(s)`)
}

type AuthUser = {
  id: string
  email?: string
  last_sign_in_at?: string
  email_confirmed_at?: string
  factors?: { status: string }[]
}

async function fetchAllAuthUsers(supabase: SupabaseClient): Promise<Map<string, AuthUser>> {
  const byId = new Map<string, AuthUser>()
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) die(`Supabase listUsers failed: ${error.message}`)
    for (const u of data.users as AuthUser[]) byId.set(u.id, u)
    if (data.users.length < perPage) break
  }
  return byId
}

async function listUsers(ctx: Ctx) {
  const [users, authUsers] = await Promise.all([
    ctx.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { memberships: { include: { committee: { select: { slug: true } } } } },
    }),
    fetchAllAuthUsers(ctx.supabase),
  ])

  console.table(
    users.map((u) => {
      const auth = authUsers.get(u.id)
      const factors = auth?.factors ?? []
      const verified = factors.filter((f) => f.status === 'verified').length
      return {
        email: u.email,
        name: u.name ?? '—',
        committees: u.memberships.map((m) => `${m.committee.slug}:${m.role}`).join(', ') || '—',
        lastSignIn: auth?.last_sign_in_at?.slice(0, 16).replace('T', ' ') ?? '—',
        confirmed: auth ? (auth.email_confirmed_at ? 'yes' : 'no') : 'NO AUTH ROW',
        mfa: factors.length > 0 ? `${verified} verified / ${factors.length} total` : '—',
      }
    })
  )

  const orphans = [...authUsers.values()].filter((a) => !users.some((u) => u.id === a.id))
  if (orphans.length > 0) {
    console.log(`\nAuth users with no app User row (abandoned signups/invites):`)
    for (const o of orphans) console.log(`  ${o.email ?? o.id}`)
  }
  console.log(`${users.length} app user(s), ${authUsers.size} auth user(s)`)
}

async function findUserId(ctx: Ctx, email: string): Promise<{ id: string; email: string }> {
  const user = await ctx.prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (user) return { id: user.id, email: user.email }

  // Fall back to auth — covers users who never finished accepting an invite.
  const authUsers = await fetchAllAuthUsers(ctx.supabase)
  const match = [...authUsers.values()].find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )
  if (match) return { id: match.id, email: match.email! }
  die(`no user found with email ${email}`)
}

async function unlockMfa(ctx: Ctx, email: string | undefined, doDelete: boolean) {
  if (!email) die('usage: unlock-mfa <email> [--delete]')
  const user = await findUserId(ctx, email)

  const { data, error } = await ctx.supabase.auth.admin.mfa.listFactors({ userId: user.id })
  if (error) die(`listFactors failed: ${error.message}`)
  const factors = data?.factors ?? []

  if (factors.length === 0) {
    console.log(`${user.email} has no MFA factors — nothing to unlock.`)
    return
  }

  console.log(`MFA factors for ${user.email} (${user.id}):`)
  for (const f of factors) {
    console.log(`  ${f.id}  ${f.factor_type}  ${f.status}  "${f.friendly_name ?? ''}"  created ${f.created_at}`)
  }

  if (!doDelete) {
    console.log(`\nDry run — pass --delete to remove all ${factors.length} factor(s).`)
    return
  }

  requireYesInProd(ctx, `delete ${factors.length} MFA factor(s) for ${user.email}`)
  for (const f of factors) {
    const { error: delError } = await ctx.supabase.auth.admin.mfa.deleteFactor({
      id: f.id,
      userId: user.id,
    })
    if (delError) die(`deleteFactor ${f.id} failed: ${delError.message}`)
    console.log(`  deleted ${f.id} (${f.status})`)
  }
  console.log(`\nDone. ${user.email} can now sign in with password only and re-enroll from /app/security.`)
}

async function setSubscription(
  ctx: Ctx,
  slug: string | undefined,
  status: string | undefined,
  trialEnds: string | undefined
) {
  const validStatuses = Object.values(SubscriptionStatus)
  if (!slug || !status || !validStatuses.includes(status as SubscriptionStatus)) {
    die(`usage: set-subscription <slug> <${validStatuses.join('|')}> [--trial-ends=YYYY-MM-DD]`)
  }

  let trialEndsAt: Date | undefined
  if (trialEnds) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trialEnds)) die('--trial-ends must be YYYY-MM-DD')
    trialEndsAt = new Date(`${trialEnds}T23:59:59Z`)
  }

  const committee = await ctx.prisma.committee.findUnique({ where: { slug } })
  if (!committee) {
    const all = await ctx.prisma.committee.findMany({ select: { slug: true } })
    die(`no committee with slug "${slug}". Known slugs: ${all.map((c) => c.slug).join(', ')}`)
  }

  requireYesInProd(ctx, `change subscription for ${slug}`)
  const updated = await ctx.prisma.committee.update({
    where: { id: committee.id },
    data: { subscriptionStatus: status as SubscriptionStatus, ...(trialEndsAt ? { trialEndsAt } : {}) },
  })

  console.log(`${committee.name} (${slug})`)
  console.log(`  subscriptionStatus: ${committee.subscriptionStatus ?? '—'} → ${updated.subscriptionStatus}`)
  console.log(
    `  trialEndsAt:        ${committee.trialEndsAt?.toISOString() ?? '—'} → ${updated.trialEndsAt?.toISOString() ?? '—'}`
  )
  if (committee.stripeSubscriptionId) {
    console.log(
      `  Note: this committee has Stripe subscription ${committee.stripeSubscriptionId} — the next webhook event will overwrite this status.`
    )
  }
}

function requireYesInProd(ctx: Ctx, action: string) {
  if (ctx.prod && !ctx.yes) {
    die(`refusing to ${action} in PRODUCTION without --yes`)
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────

async function main() {
  const rawArgs = process.argv.slice(2)
  const flagArgs = rawArgs.filter((a) => a.startsWith('--'))
  const args = rawArgs.filter((a) => !a.startsWith('--'))
  const hasFlag = (name: string) => flagArgs.includes(`--${name}`)
  const flagValue = (name: string) =>
    flagArgs.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

  const [command, ...rest] = args
  if (!command || hasFlag('help')) {
    console.log(USAGE)
    process.exit(command ? 0 : 1)
  }

  const prod = hasFlag('prod')
  const env = loadEnv(prod)

  console.error(
    `Target: ${prod ? '⚠ PRODUCTION' : 'local'} — db ${hostOf(env.DATABASE_URL)}, auth ${hostOf(env.NEXT_PUBLIC_SUPABASE_URL)}\n`
  )

  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Only the auth admin API is used; a stub transport stops supabase-js from
    // demanding a WebSocket implementation Node 20 doesn't ship.
    realtime: { transport: class {} as unknown as undefined },
  })
  const ctx: Ctx = { prisma, supabase, prod, yes: hasFlag('yes') }

  try {
    switch (command) {
      case 'list-committees':
        await listCommittees(ctx)
        break
      case 'list-users':
        await listUsers(ctx)
        break
      case 'unlock-mfa':
        await unlockMfa(ctx, rest[0], hasFlag('delete'))
        break
      case 'set-subscription':
        await setSubscription(ctx, rest[0], rest[1], flagValue('trial-ends'))
        break
      default:
        console.log(USAGE)
        die(`unknown command "${command}"`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
