# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # ESLint

npm run db:generate  # regenerate Prisma client after schema changes
npm run db:push      # push schema to Supabase (uses .env, not .env.local)
npm run db:studio    # open Prisma Studio GUI
npm run db:seed      # seed database from prisma/seed.ts
```

## Two env files are required

The Prisma CLI only reads `.env`; Next.js runtime reads `.env.local`. Both must exist with the same `DATABASE_URL` and `DIRECT_URL` values. See `.env.example` for all variables.

## Architecture

**Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (Auth + PostgreSQL), Prisma ORM.**

### Route structure

```
app/
  login/                         # public auth pages
  accept-invite/
  auth/callback/
  app/
    page.tsx                     # committee selector (post-login landing)
    [committeeSlug]/
      layout.tsx                 # Sidebar shell, verifies committee membership
      dashboard/ members/ donations/ expenses/ bank/ filings/
  api/
    invite/                      # server-side Supabase admin invite
    plaid/link-token|exchange-token|sync/
    webhooks/anedot/             # public — excluded from auth middleware
```

All authenticated app pages live under `app/app/[committeeSlug]/`. The `committeeSlug` param is the tenant discriminator; every Prisma query must scope to `committeeId`.

### Mutations use Server Actions

`actions/donations.ts`, `actions/expenses.ts`, `actions/members.ts`, `actions/committees.ts` are `'use server'` files. Pages call these directly rather than hitting API routes. Plaid uses API routes instead because its flow is client-initiated.

### Mock data — most pages are not yet wired to the database

Pages import from `lib/mock-data.ts` by default. `// TODO: replace with Prisma query` comments mark every location that needs a real Prisma call. When connecting a page, import `prisma` from `lib/db` and scope the query by `committeeId`.

### Key library files

- `lib/types.ts` — all TypeScript interfaces shared across client and server, plus `getSeecStatus()` which is the core SEEC compliance evaluation function
- `lib/analytics.ts` — aggregation helpers that transform raw contributions/expenditures into chart-ready data
- `lib/form20.ts` — generates the eCRIS Form 20 `.xls` workbook (SheetJS); maps `ExpenseCategory` enum values to SEEC purpose codes
- `lib/anedot-csv.ts` — PapaParse-based CSV parser that handles Anedot column name variants and deduplicates against existing `anedotId` values
- `lib/supabase/client.ts` / `server.ts` — browser and server Supabase clients; server.ts also exports an `adminClient` that bypasses RLS (requires `SUPABASE_SERVICE_ROLE_KEY`)

### Multi-tenancy

The app is multi-committee. `Committee` is the tenant root in Prisma. Every `Contribution`, `Expenditure`, `BankAccount`, `SeecFiling`, and `CommitteeMembership` has a `committeeId` FK. Middleware (`middleware.ts`) handles session refresh and redirects unauthenticated requests to `/login`; it does **not** validate committee membership — that happens in `app/app/[committeeSlug]/layout.tsx`.

### SEEC compliance

Connecticut SEEC requires itemized donor details (address, employer, occupation) for contributions ≥ $50. `getSeecStatus()` in `lib/types.ts` returns `compliant | missing_info | incomplete`. The Form 20 export maps `PaymentMethod` → SEEC method codes (`PC`, `CA`, `CD`) and `ExpenseCategory` → SEEC purpose codes (`PRNT`, `POST`, `A-SIGN`, etc.).

### Auth / invite flow

Access is invitation-only. `POST /api/invite` calls `supabase.auth.admin.inviteUserByEmail()` (requires service role key). Invitees land on `/accept-invite` after clicking the email link; after setting their password, a `CommitteeMembership` row is created in Prisma. The Supabase `User.id` must match `auth.users.id` — do not generate separate IDs.

### Plaid bank sync

Uses cursor-based `transactionsSync`. Sandbox credentials: `user_good` / `pass_good`. Set `PLAID_ENV=sandbox` for local development.
