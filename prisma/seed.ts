/**
 * Prisma seed script — creates the initial committee records.
 *
 * Run with:  npx prisma db seed
 *            or: npx ts-node prisma/seed.ts
 *
 * After seeding, add yourself as Treasurer by running this SQL in the
 * Supabase SQL editor (replace the values with your own):
 *
 *   -- 1. Create your User record (use your Supabase auth user ID)
 *   INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
 *   VALUES ('your-supabase-auth-user-id', 'you@email.com', 'Your Name', now(), now())
 *   ON CONFLICT (id) DO NOTHING;
 *
 *   -- 2. Add yourself to your committee
 *   INSERT INTO "CommitteeMembership" (id, "userId", "committeeId", role)
 *   VALUES (gen_random_uuid()::text, 'your-supabase-auth-user-id',
 *           (SELECT id FROM "Committee" WHERE slug = 'your-committee-slug'),
 *           'TREASURER');
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── Committees ────────────────────────────────────────────────────────────
  // Edit these to match your actual committees. Add or remove as needed.

  const committees = await Promise.all([
    prisma.committee.upsert({
      where: { slug: 'guilford-dtc' },
      create: {
        name: 'Guilford Democratic Town Committee',
        slug: 'guilford-dtc',
        seecId: 'CT-DTC-20240142',
        city: 'Guilford',
        state: 'CT',
        electionYear: 2024,
      },
      update: {},
    }),
    // A candidate committee for exercising the per-phase limit rules and Form 30 flow.
    prisma.committee.upsert({
      where: { slug: 'friends-of-pat-doe' },
      create: {
        name: 'Friends of Pat Doe',
        slug: 'friends-of-pat-doe',
        city: 'Guilford',
        state: 'CT',
        electionYear: 2026,
        type: 'CANDIDATE',
        candidateName: 'Pat Doe',
        officeSought: 'STATE_REPRESENTATIVE',
        district: '98th Assembly District',
        cepParticipant: false,
        primaryDate: new Date('2026-08-11T00:00:00Z'),
        electionDate: new Date('2026-11-03T00:00:00Z'),
      },
      update: {},
    }),
    // Add more committees here:
    // prisma.committee.upsert({
    //   where: { slug: 'your-committee' },
    //   create: { name: '...', slug: '...', seecId: '...', city: '...', state: 'CT', electionYear: 2024 },
    //   update: {},
    // }),
  ])

  committees.forEach((c) => console.log(`  ✓ Committee: ${c.name} (${c.slug})`))

  console.log('\nDone. Next step: add yourself as Treasurer via the Supabase SQL editor.')
  console.log('See the comment at the top of this file for the SQL to run.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
