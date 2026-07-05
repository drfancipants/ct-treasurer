import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['TREASURER','ASSISTANT_TREASURER','CHAIRPERSON','SECRETARY','MEMBER','VIEWER']),
  committeeId: z.string(),
  committeeName: z.string(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, name, role, committeeId, committeeName } = parsed.data

  const callerMembership = await prisma.committeeMembership.findFirst({
    where: {
      userId: user.id,
      committeeId,
      role: { in: ['TREASURER', 'ASSISTANT_TREASURER'] },
    },
  })
  if (!callerMembership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 503 })
  }

  const adminClient = createAdminClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback?type=invite`

  async function addMembership(userId: string) {
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email, name },
      update: { name },
    })
    return prisma.committeeMembership.upsert({
      where: { userId_committeeId: { userId, committeeId } },
      create: { userId, committeeId, role },
      update: { role },
    })
  }

  // Does this email already have an account? Check Supabase Auth directly —
  // a user can exist in auth without a Prisma User row, so a Prisma-only
  // lookup misses them and inviteUserByEmail then errors on the known email.
  const { data: list, error: listErr } = await adminClient.auth.admin.listUsers()
  if (listErr) {
    console.error('[invite] listUsers', listErr)
    return NextResponse.json({ error: 'Could not check existing users' }, { status: 500 })
  }
  const authUser = list.users.find(
    (u: { email?: string | null }) => u.email?.toLowerCase() === email.toLowerCase()
  )

  // An invited-but-never-signed-in user still shows up here (generateLink
  // creates the auth.users row immediately) — treat them the same as a
  // brand-new invite so "resend invite" produces a fresh link, instead of
  // silently no-op'ing because "an account already exists".
  if (authUser && !authUser.last_sign_in_at) {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo, data: { name, role, committeeId, committeeName } },
    })
    if (error || !data.user) {
      console.error('[invite] generateLink (resend)', error)
      return NextResponse.json({ error: error?.message ?? 'Failed to create invite' }, { status: 500 })
    }
    const membership = await addMembership(data.user.id)
    return NextResponse.json({
      success: true,
      userId: data.user.id,
      inviteLink: data.properties.action_link,
      membershipId: membership.id,
      joinedAt: membership.joinedAt.toISOString().split('T')[0],
    })
  }

  if (authUser) {
    // Already has a login — just grant the committee membership. No email:
    // they sign in with their existing credentials.
    const membership = await addMembership(authUser.id)
    return NextResponse.json({
      success: true,
      userId: authUser.id,
      existingUser: true,
      membershipId: membership.id,
      joinedAt: membership.joinedAt.toISOString().split('T')[0],
    })
  }

  // New person — generate an invite link and return it so the treasurer can
  // share it directly. This does not rely on Supabase's built-in email
  // (rate-limited and often undelivered); generateLink sends nothing itself.
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: { name, role, committeeId, committeeName } },
  })
  if (error || !data.user) {
    console.error('[invite] generateLink', error)
    return NextResponse.json({ error: error?.message ?? 'Failed to create invite' }, { status: 500 })
  }

  const membership = await addMembership(data.user.id)

  return NextResponse.json({
    success: true,
    userId: data.user.id,
    inviteLink: data.properties.action_link,
    membershipId: membership.id,
    joinedAt: membership.joinedAt.toISOString().split('T')[0],
  })
}
