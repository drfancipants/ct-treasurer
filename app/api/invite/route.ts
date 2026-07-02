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

  // If this person already has an account, add the committee membership
  // directly — Supabase's inviteUserByEmail rejects an already-registered
  // email, which would otherwise block adding an existing user to a second
  // committee. (User.id === auth.users.id by the app's invariant.)
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (existing) {
    await prisma.committeeMembership.upsert({
      where: { userId_committeeId: { userId: existing.id, committeeId } },
      create: { userId: existing.id, committeeId, role },
      update: { role },
    })
    return NextResponse.json({ success: true, userId: existing.id, existingUser: true })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 503 })
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback?type=invite`,
    data: { name, role, committeeId, committeeName },
  })

  if (error) {
    console.error('[invite]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userId = data.user.id

  // Create User record in Prisma (matches Supabase auth user ID)
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name },
    update: { name },
  })

  // Create CommitteeMembership
  await prisma.committeeMembership.upsert({
    where: { userId_committeeId: { userId, committeeId } },
    create: { userId, committeeId, role },
    update: { role },
  })

  return NextResponse.json({ success: true, userId })
}
