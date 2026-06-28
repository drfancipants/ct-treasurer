import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, name, role, committeeId, committeeName } = parsed.data

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
