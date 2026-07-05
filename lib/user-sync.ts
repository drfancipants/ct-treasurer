import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

/**
 * Upserts a public-schema User row keyed to a Supabase Auth user id.
 *
 * A Supabase Auth account can be deleted and recreated for the same email
 * (e.g. after an admin fully removes someone) — the new account gets a new
 * id, but a stale User row from the old one can still be sitting on that
 * email. Upserting by id alone would then try to create a second row and
 * collide with User.email's unique constraint. Reconcile by email first: if
 * a stale row under a different id exists, replace it (and its now-
 * meaningless memberships, tied to an auth account that no longer exists)
 * rather than colliding with it.
 */
export async function upsertAuthUser(
  userId: string,
  email: string,
  create: Omit<Prisma.UserCreateInput, 'id' | 'email'>,
  update: Prisma.UserUpdateInput
) {
  const staleUser = await prisma.user.findUnique({ where: { email } })
  if (staleUser && staleUser.id !== userId) {
    await prisma.committeeMembership.deleteMany({ where: { userId: staleUser.id } })
    await prisma.user.delete({ where: { id: staleUser.id } })
  }

  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, ...create },
    update,
  })
}
