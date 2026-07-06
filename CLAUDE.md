# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # ESLint (flat config in eslint.config.mjs — `next lint` was removed in Next 16)
npm test             # vitest — unit tests in lib/__tests__/

npm run db:generate  # regenerate Prisma client after schema changes
npm run db:push      # push schema to Supabase (uses .env, not .env.local)
npm run db:studio    # open Prisma Studio GUI
npm run db:seed      # seed database from prisma/seed.ts
```

## Two env files are required

The Prisma CLI only reads `.env`; Next.js runtime reads `.env.local`. Both must exist with the same `DATABASE_URL` and `DIRECT_URL` values. See `.env.example` for all variables.

## Deployment

Production runs on Vercel: **https://ct-treasurer.vercel.app** (project `ct-treasurer`, deployed via `npx vercel --prod` from this directory — no git integration yet). Most env vars from `.env.local` are mirrored in Vercel production, except: `NEXT_PUBLIC_APP_URL` (set to the production URL), `STRIPE_WEBHOOK_SECRET` (the production value is the signing secret of the Stripe webhook endpoint registered at `/api/webhooks/stripe`, not the local CLI one), and **all Supabase/database vars** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`) — local dev and production point at **separate Supabase projects** (separate Postgres databases and separate Auth user pools), so a `User.id` or committee that exists in one does not exist in the other. `postinstall` runs `prisma generate` for Vercel builds.

## Architecture

**Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase (Auth + PostgreSQL), Prisma ORM, Stripe billing.**

### Route structure

```
app/
  login/ signup/                 # public auth pages
  accept-invite/
  auth/callback/
  terms/ privacy/
  app/
    page.tsx                     # committee selector; single membership → redirects to dashboard
    create-committee/
    [committeeSlug]/
      layout.tsx                 # Sidebar shell, verifies committee membership
      dashboard/ members/ donations/ expenses/ bank/ filings/ settings/
  api/
    invite/                      # server-side Supabase admin invite
    plaid/link-token|exchange-token|sync/
    stripe/checkout|portal/
    webhooks/anedot/             # public — HMAC-signed, excluded from auth proxy
    webhooks/stripe/             # public — Stripe-signature verified
```

All authenticated app pages live under `app/app/[committeeSlug]/`. The `committeeSlug` param is the tenant discriminator; every Prisma query must scope to `committeeId`.

### Mutations use Server Actions

`actions/donations.ts`, `actions/expenses.ts`, `actions/members.ts`, `actions/committees.ts` are `'use server'` files. Pages call these directly rather than hitting API routes. Plaid and Stripe use API routes instead because their flows are client-initiated or webhook-driven.

All pages are wired to the database via Prisma (`lib/db`). List pages fetch server-side and pass into client table components that keep local state; dialogs apply server-action results to that state (see `DonationsTable` + `AnedotImportDialog` — the import dialog must stay open through its confirmation step, so its parent must not close it in `onImport`).

### Tests

Vitest unit tests live in `lib/__tests__/` and cover the compliance-critical pure logic: `getSeecStatus()` ($50 itemization rules), `form20.ts` (SEEC code mappings, exercised against the real template in `public/templates/`), and `anedot-csv.ts` (column variants, dedup, refund skipping). Run with `npm test`.

### Key library files

- `lib/types.ts` — all TypeScript interfaces shared across client and server, plus `getSeecStatus()` which is the core SEEC compliance evaluation function
- `lib/analytics.ts` — aggregation helpers that transform raw contributions/expenditures into chart-ready data
- `lib/form20.ts` — generates the eCRIS Form 20 `.xls` workbook (SheetJS) from the template in `public/templates/`; maps `ExpenseCategory` enum values to SEEC purpose codes
- `lib/anedot-csv.ts` — PapaParse-based CSV parser that handles Anedot column name variants and deduplicates against existing `anedotId` values
- `lib/supabase/client.ts` / `server.ts` — browser and server Supabase clients; server.ts also exports an `adminClient` that bypasses RLS (requires `SUPABASE_SERVICE_ROLE_KEY`)
- `lib/pdf-report.ts` — the Reports page's multi-page PDF export (pdfkit, served by `POST /api/reports/pdf`): cover sheet, overview charts, itemized sections with paginating tables. Footers/headers are stamped after layout with `margins.bottom` zeroed — text whose line box crosses the bottom margin makes pdfkit silently add blank pages
- `lib/report-chart.ts` / `lib/newsletter-chart.ts` — server-rendered chart PNGs (`@napi-rs/canvas`). **All canvas text must use `CHART_FONT` from `lib/chart-font.ts`** (bundled Liberation Sans, registered at render time). Generic families like `sans-serif` resolve against system fonts, and Vercel's runtime has none — text silently renders as nothing in production. `outputFileTracingIncludes` in next.config.mjs keeps the .ttf files in every function bundle

### Roles

`FINANCE_ROLES` (`lib/auth.ts`) = TREASURER + ASSISTANT_TREASURER. Only these roles may mutate financial records — contributions, expenditures, bank linking/sync/reconciliation, and mark-as-filed all go through `requireFinanceRole()` (server actions) or a `role: { in: FINANCE_ROLES }` membership query (Plaid API routes). All other roles are read-only; pages pass `canEdit` into the table components to hide write affordances. Any new mutation must enforce this server-side — hiding the button is not enforcement.

### Multi-tenancy

The app is multi-committee. `Committee` is the tenant root in Prisma. Every `Contribution`, `Expenditure`, `BankAccount`, `SeecFiling`, and `CommitteeMembership` has a `committeeId` FK. `Contributor` is intentionally global (shared across committees, matched by email) — server actions must verify a contributor belongs to the contribution being edited before writing to it. The auth proxy (`proxy.ts` — Next 16's rename of middleware) handles session refresh and redirects unauthenticated requests to `/login`; it does **not** validate committee membership — that happens in `app/app/[committeeSlug]/layout.tsx`.

### SEEC compliance

Connecticut SEEC requires itemized donor details (address, employer, occupation) for contributions ≥ $50. `getSeecStatus()` in `lib/types.ts` returns `compliant | missing_info | incomplete`. The Form 20 export maps `PaymentMethod` → SEEC method codes (`PC`, `CA`, `CD`) and `ExpenseCategory` → SEEC purpose codes (`PRNT`, `POST`, `A-SIGN`, etc.).

### Auth / invite flow

Access is invitation-only (plus self-serve signup). `POST /api/invite` calls `supabase.auth.admin.inviteUserByEmail()` (requires service role key). Invitees land on `/accept-invite` after clicking the email link; after setting their password, a `CommitteeMembership` row is created in Prisma. The Supabase `User.id` must match `auth.users.id` — do not generate separate IDs.

### Billing (Stripe)

`Committee.subscriptionStatus` is a Prisma enum (`trialing | active | past_due | canceled`). The webhook (`app/api/webhooks/stripe/route.ts`) maps Stripe statuses through `toSubscriptionStatus()`, which fails closed: `paused` and unknown statuses become `past_due`. Webhook lookup uses `metadata.committeeId` when present, else falls back to `stripeSubscriptionId`.

### Plaid bank sync

Uses cursor-based `transactionsSync` (`syncCursor` on `BankAccount` makes repeat syncs incremental). Plaid amounts are sign-flipped on ingest so positive = deposit. Sandbox credentials: `user_good` / `pass_good`. Set `PLAID_ENV=sandbox` for local development.

### Newsletter email

Each committee connects its own Gmail account (SMTP + App Password, not OAuth) via Settings — `actions/newsletter.ts` sends roster newsletters through it. The app password is encrypted at rest with `lib/crypto.ts` (AES-256-GCM, key from `CREDENTIALS_ENCRYPTION_KEY`) — never stored or returned to a client as plaintext. Gated by `requireRosterRole()` (`lib/auth.ts`), same as other roster mutations. Sends go out as a single message with all recipients in `Bcc`; recipient email addresses are always re-derived server-side from committee-scoped `RosterMember` ids, never trusted from the client. The optional "donor contributions" chart is rendered server-side per send with `@napi-rs/canvas` (`lib/newsletter-chart.ts`) from the same trailing-12-month window as the dashboard's Monthly activity chart, and embedded via CID attachment (not a data URI, which most webmail clients strip).
