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

Production runs on Vercel at **https://www.cttreasurer.com** (custom domain; `ct-treasurer.vercel.app` routes to the same deployment — project `ct-treasurer`). The GitHub repo (`drfancipants/ct-treasurer`) is connected, so pushes to `main` auto-deploy to production; `npx vercel --prod` from this directory also works. Most env vars from `.env.local` are mirrored in Vercel production, except: `NEXT_PUBLIC_APP_URL` (set to `https://www.cttreasurer.com`), all **Stripe vars** (production is **live mode** as of 2026-07-12: `sk_live_…` key, a live-mode `STRIPE_PRICE_ID` — must be the `price_…` API ID, not the `prod_…` product ID, which Checkout rejects with "No such price" — and `STRIPE_WEBHOOK_SECRET` from the **live-mode** webhook endpoint registered at `/api/webhooks/stripe`, not the local CLI one; the Customer Portal settings are saved in live mode, which `/api/stripe/portal` requires), and **all Supabase/database vars** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`) — local dev and production point at **separate Supabase projects** (separate Postgres databases and separate Auth user pools), so a `User.id` or committee that exists in one does not exist in the other. Server-side production env vars are stored as **Sensitive** in Vercel — runtime-only and write-only (`vercel env pull` returns them as empty strings). The three `NEXT_PUBLIC_*` vars are deliberately **regular (encrypted) vars**: Sensitive vars are invisible to builds, and a Sensitive `NEXT_PUBLIC_SUPABASE_URL` breaks `next build` at the `/signup` prerender ("Invalid supabaseUrl") — this can hide behind a restored build cache and only surface on a fresh compile. Note `vercel env add` (CLI v55) creates Sensitive vars by default; to add a build-visible var, use the dashboard or the REST API with `type: "encrypted"`. `postinstall` runs `prisma generate` for Vercel builds.

## Architecture

**Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase (Auth + PostgreSQL), Prisma ORM, Stripe billing.**

### Route structure

```
app/
  login/ signup/                 # public auth pages
  accept-invite/
  auth/callback/
  mfa/                           # TOTP challenge page (AAL1 sessions with a verified factor land here)
  terms/ privacy/ quickstart/
  app/
    page.tsx                     # committee selector; single membership → redirects to dashboard
    create-committee/
    security/                    # per-user account security (TOTP MFA enrollment)
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

Vitest unit tests live in `lib/__tests__/` and cover the compliance-critical pure logic: `getSeecStatus()` ($50 itemization rules), `limits.ts` (party calendar-year + candidate per-phase/CEP limits), `filing-periods.ts` (quarterly + statutory candidate periods), `form20.ts` (SEEC code mappings, exercised against the real template in `public/templates/`), and `anedot-csv.ts` (column variants, dedup, refund skipping). Run with `npm test`.

### Key library files

- `lib/types.ts` — all TypeScript interfaces shared across client and server, plus `getSeecStatus()` which is the core SEEC compliance evaluation function
- `lib/analytics.ts` — aggregation helpers that transform raw contributions/expenditures into chart-ready data
- `lib/limits.ts` — CT contribution-limit engine. A `LimitPolicy` derived from the committee (`getLimitPolicy`) drives every check: party committees use $2,000/donor/**calendar year**; candidate committees use office-based limits applied **separately per primary/election phase** (`bucketFor` splits on `primaryDate`); CEP participants use the per-cycle cap (`CEP_CYCLE_LIMITS`) and prohibit committee/PAC/state-contractor money. All exported functions take the policy as a trailing optional param defaulting to `PARTY_POLICY`, so party call sites are unchanged. `createRunningLimitChecker` is the shared batch checker used by the Anedot import
- `lib/form20.ts` / `lib/form30.ts` — generate the eCRIS Form 20 / Form 30 `.xls` workbooks (SheetJS) from the templates in `public/templates/`; map `ExpenseCategory` to SEEC purpose codes. **The two forms have genuinely different column layouts** (Form 30 Section B has an extra "Contribution ID" column shifting everything; its events/in-kind/expense sections drop or reorder columns), so each has its own row-builders — they only share code-maps and the preview math via `lib/seec-export.ts`. `FilingExportDialog` picks the populate fn by `formNumber` (20 vs 30). Both are exercised against their real templates in `lib/__tests__/`
- `lib/seec-export.ts` — form-agnostic SEEC export machinery shared by Form 20/30: method/purpose code maps, `previewFiling` (per-section counts/totals), and `FORM_SECTIONS` (which eCRIS section letter each record type lands in per form: Form 20 uses A/B/C1/L1/M/P/T, Form 30 uses A/B/C1/J1/K/N/R). `FilingExportDialog` keeps a `summaryOnly` fallback that shows the preview totals if a template file is ever missing at runtime
- `lib/anedot-csv.ts` — PapaParse-based CSV parser that handles Anedot column name variants and deduplicates against existing `anedotId` values; takes a `LimitPolicy` to flag over-limit rows under the committee's rules
- `lib/supabase/client.ts` / `server.ts` — browser and server Supabase clients; server.ts also exports an `adminClient` that bypasses RLS (requires `SUPABASE_SERVICE_ROLE_KEY`)
- `lib/pdf-report.ts` — the Reports page's multi-page PDF export (pdfkit, served by `POST /api/reports/pdf`): cover sheet, overview charts, itemized sections with paginating tables. Footers/headers are stamped after layout with `margins.bottom` zeroed — text whose line box crosses the bottom margin makes pdfkit silently add blank pages
- `lib/report-chart.ts` / `lib/newsletter-chart.ts` — server-rendered chart PNGs (`@napi-rs/canvas`). **All canvas text must use `CHART_FONT` from `lib/chart-font.ts`** (bundled Liberation Sans, registered at render time). Generic families like `sans-serif` resolve against system fonts, and Vercel's runtime has none — text silently renders as nothing in production. `outputFileTracingIncludes` in next.config.mjs keeps the .ttf files in every function bundle

### Roles

`FINANCE_ROLES` (`lib/auth.ts`) = TREASURER + ASSISTANT_TREASURER. Only these roles may mutate financial records — contributions, expenditures, bank linking/sync/reconciliation, and mark-as-filed all go through `requireFinanceRole()` (server actions) or a `role: { in: FINANCE_ROLES }` membership query (Plaid API routes). All other roles are read-only; pages pass `canEdit` into the table components to hide write affordances. Any new mutation must enforce this server-side — hiding the button is not enforcement.

### Multi-tenancy

The app is multi-committee. `Committee` is the tenant root in Prisma. Every `Contribution`, `Expenditure`, `BankAccount`, `SeecFiling`, and `CommitteeMembership` has a `committeeId` FK. `Contributor` is intentionally global (shared across committees, matched by email) — server actions must verify a contributor belongs to the contribution being edited before writing to it. The auth proxy (`proxy.ts` — Next 16's rename of middleware) handles session refresh and redirects unauthenticated requests to `/login`; it does **not** validate committee membership — that happens in `app/app/[committeeSlug]/layout.tsx`.

### SEEC compliance

Connecticut SEEC requires itemized donor details (address, employer, occupation) for contributions ≥ $50. `getSeecStatus()` in `lib/types.ts` returns `compliant | missing_info | incomplete`. The Form 20 export maps `PaymentMethod` → SEEC method codes (`PC`, `CA`, `CD`) and `ExpenseCategory` → SEEC purpose codes (`PRNT`, `POST`, `A-SIGN`, etc.).

`Committee.type` is `PARTY` (town committee) or `CANDIDATE` (a single candidate's campaign), set at creation and immutable. Candidate committees carry `officeSought`, `district`, `cepParticipant`, `primaryDate`, `electionDate`, and file **Form 30** (statewide & General Assembly offices per `FORM_30_OFFICES`) or Form 20 (municipal/probate) — derived server-side in `actions/filings.ts`. Their filing calendar adds statutory "7th day preceding" primary/election statements (`generateStatutoryCandidatePeriods` in `lib/filing-periods.ts`). Town-committee-only features (membership dues on the dashboard, settings, roster, and newsletter) are gated off for candidate committees via a `showDues`/type check; the candidate dashboard shows `LimitStatusCard` in place of the dues donut. See `lib/limits.ts` for the per-type/per-phase/CEP contribution limits.

### Auth / invite flow

Access is invitation-only (plus self-serve signup). `POST /api/invite` calls `supabase.auth.admin.inviteUserByEmail()` (requires service role key). Invitees land on `/accept-invite` after clicking the email link; after setting their password, a `CommitteeMembership` row is created in Prisma. The Supabase `User.id` must match `auth.users.id` — do not generate separate IDs.

**Optional TOTP MFA** (Supabase Auth native): users enroll from `/app/security` (`MfaSettings`), and the proxy enforces AAL2 — any session at `aal1` whose user has a verified factor is redirected to the `/mfa` challenge page before reaching *any* authenticated route, covering password and magic-link sign-ins alike. Gotcha: `listFactors().totp` contains only **verified** factors; stale unverified ones (abandoned enrollments) live in `.all` and block re-enrollment under the same friendly name until unenrolled. There are no recovery codes — a locked-out user needs their factor deleted via the Supabase admin API.

### Billing (Stripe)

`Committee.subscriptionStatus` is a Prisma enum (`trialing | active | past_due | canceled`). The webhook (`app/api/webhooks/stripe/route.ts`) maps Stripe statuses through `toSubscriptionStatus()`, which fails closed: `paused` and unknown statuses become `past_due`. Webhook lookup uses `metadata.committeeId` when present, else falls back to `stripeSubscriptionId`.

### Plaid bank sync

Uses cursor-based `transactionsSync` (`syncCursor` on `BankAccount` makes repeat syncs incremental). Plaid amounts are sign-flipped on ingest so positive = deposit. Sandbox credentials: `user_good` / `pass_good`. Set `PLAID_ENV=sandbox` for local development.

### Newsletter email

Each committee connects its own Gmail account (SMTP + App Password, not OAuth) via Settings — `actions/newsletter.ts` sends roster newsletters through it. The app password is encrypted at rest with `lib/crypto.ts` (AES-256-GCM, key from `CREDENTIALS_ENCRYPTION_KEY`) — never stored or returned to a client as plaintext. Gated by `requireRosterRole()` (`lib/auth.ts`), same as other roster mutations. Sends go out as a single message with all recipients in `Bcc`; recipient email addresses are always re-derived server-side from committee-scoped `RosterMember` ids, never trusted from the client. The optional "donor contributions" chart is rendered server-side per send with `@napi-rs/canvas` (`lib/newsletter-chart.ts`) from the same trailing-12-month window as the dashboard's Monthly activity chart, and embedded via CID attachment (not a data URI, which most webmail clients strip).
