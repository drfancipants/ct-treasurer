# CT Committee Treasurer Suite

Campaign-finance management and SEEC compliance for Connecticut town committees.

**Live:** https://ct-treasurer.vercel.app

Each committee is a separate tenant with its own members, records, bank connection, and subscription. One login can manage several committees and switch between them.

---

## What it does

- **Dashboard** — monthly raised/spent, cumulative balance, payment-method and expense-category breakdowns, SEEC compliance status; every chart has an empty state until data exists.
- **Donations** — two tabs:
  - **Individuals** (Section B) — manual entry, Anedot CSV import, and Anedot webhook ingestion; per-contribution SEEC status badges; phone, check number, and notes captured from CSV imports.
  - **Other committees** (Section C1) — contributions received from other committees.
- **Contribution limits** — tracks each donor's calendar-year total against CT's limits for town committees ($2,000 / individual / year; single cash contributions capped at $100 per CGS § 9-611). Donors are grouped even across duplicate records; warnings appear on the donations page, in the entry dialog as you type, and on CSV import.
- **Expenses** — expenditure tracking using the full set of official SEEC Section P purpose codes (e.g. `A-RAD: Advertise on radio`).
- **Events** — fundraising events (Section L1) with SEEC's event questions and food/tag-sale receipts; auto-assigned or hand-picked event letters. Contributions and expenses can be linked to an event, which fills the event columns in Sections B, C1, and P.
- **Bank accounts** — Plaid bank link with cursor-based transaction sync (up to 24 months of history) and reconciliation against contributions/expenses.
- **Reports** — contribution totals with a date-range filter and Year-to-Date / Previous-Year presets; tabs for Overview, By donor, and Events; sortable, paginated tables.
- **SEEC filings** — one-click generation of the eCRIS Form 20 upload template, pre-filled with Sections **A** (small contributors), **B** (itemized contributions), **C1** (committee contributions), **P** (expenses), and **L1** (events). Marking a period filed stamps every record in it with a filing date, shown per row.
- **Members & roles** — committee roster; only treasurers and assistant treasurers can modify financial records — everyone else is read-only. Add an existing user to a committee instantly, or invite a new person with a shareable link (no dependence on email delivery).
- **Billing** — per-committee Stripe subscription ($9.99/month) with a 14-day trial; an unpaid or expired committee is gated to a subscribe page.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth (email/password + magic link) |
| Billing | Stripe (subscriptions) |
| Bank sync | Plaid |
| Charts | Recharts |
| CSV parsing | PapaParse |
| Excel generation | SheetJS (xlsx) |
| Validation | Zod |
| Tests | Vitest |
| Hosting | Vercel |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Two env files are required

Next.js reads `.env.local` at runtime; the Prisma CLI only reads `.env`. Both must exist with the same `DATABASE_URL` and `DIRECT_URL`.

```bash
cp .env.example .env.local
cp .env.example .env
```

Fill in `.env.local` (all variables) and `.env` (at least `DATABASE_URL` + `DIRECT_URL`):

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret) |
| `DATABASE_URL` | Supabase → Database → Connection pooler (port 6543) |
| `DIRECT_URL` | Supabase → Database → Direct connection (port 5432) |
| `ANEDOT_WEBHOOK_SECRET` | Any random string; enter the same value in Anedot |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | dashboard.plaid.com |
| `PLAID_ENV` | `sandbox` for dev, `production` for live |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | dashboard.stripe.com |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the Stripe webhook endpoint |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |

`.env*` files are gitignored — never commit secrets.

### 3. Set up the database

```bash
npm run db:generate   # generate the Prisma client
npm run db:push       # push schema to Supabase
```

### 4. Run the dev server

```bash
npm run dev           # → http://localhost:3000
```

Access is invitation-only, so seed a committee and add yourself as treasurer — `prisma/seed.ts` creates a committee, and the comment at the top shows the SQL to grant yourself membership. From there the in-app **"+ New committee"** action (committee switcher) creates additional committees and makes you their treasurer.

---

## Architecture notes

- **Multi-tenancy.** `Committee` is the tenant root; every record carries a `committeeId`. All authenticated pages live under `app/app/[committeeSlug]/`; the layout verifies committee membership and subscription entitlement (`lib/entitlement.ts`).
- **Auth proxy.** `proxy.ts` (Next 16's rename of middleware) refreshes the session and redirects unauthenticated requests to `/login`.
- **Mutations are Server Actions** (`actions/*.ts`); Plaid and Stripe use API routes because they're client-initiated or webhook-driven. Financial mutations go through `requireFinanceRole()` — hiding a button is never the only guard.
- **Roles.** `FINANCE_ROLES` (treasurer, assistant treasurer) may write; all other roles are read-only. Pages pass `canEdit` to hide write affordances.
- **SEEC codes** live in `lib/types.ts` (expense purpose codes, payment-method mappings) and `lib/form20.ts` (workbook population, one block per section against the real eCRIS template in `public/templates/`).
- **Webhooks** are signature-verified: Anedot (HMAC-SHA256) and Stripe (Stripe signature), both public routes excluded from the auth proxy.

## Key directories

```
app/app/[committeeSlug]/   dashboard members donations expenses bank filings events reports settings
app/app/subscribe/         per-committee paywall (outside the gated layout)
app/api/                   invite  plaid/*  stripe/checkout|portal  webhooks/anedot|stripe
actions/                   donations expenses committee-contributions events committees members filings bank
lib/                       types  form20  limits  events  entitlement  analytics  anedot-csv  auth  db  supabase/*
lib/__tests__/             vitest unit tests
prisma/schema.prisma       full database schema
public/templates/          official SEEC eCRIS Form 20 template
```

---

## SEEC filings

**Generate:** SEEC Filings → **Generate Form 20** for a period. The download is the official eCRIS template pre-filled:

| Section | Contents |
|---|---|
| A | Aggregate total of non-itemized (< $50) contributions |
| B | Itemized individual contributions (method codes, employer/occupation, event columns) |
| C1 | Contributions received from other committees |
| P | Committee expenses with SEEC purpose codes |
| L1 | Fundraising events with the SEEC event questions and receipts |

Contributions/expenses linked to an event fill that event's date and letter in the relevant section. Upload the `.xlsx` at **seec.ct.gov → eCRIS → Upload Report**.

`getSeecStatus()` (`lib/types.ts`) evaluates each contribution and returns `compliant` / `missing_info` / `incomplete`, shown as a badge per row and summarized on the dashboard. Itemized contributions ≥ $50 require full name, address, employer, occupation.

---

## Integrations

**Anedot** — webhook (real-time) at `/api/webhooks/anedot` (HMAC-SHA256 verified, deduped by donation UID, routed to a committee by `anedotAccountId`), plus bulk CSV import (auto-detects column variants, dedupes, flags SEEC and contribution-limit issues before importing). Anedot has no public pull API; these are the two sync paths.

**Plaid** — Connect on **Bank accounts** → cursor-based `transactionsSync` (paginated; requests up to 24 months of history). Sandbox creds for dev: `user_good` / `pass_good`. Only the synced account's transactions are stored; existing links must be reconnected to widen their history window.

**Stripe** — per-committee subscription with a 14-day trial via checkout; the webhook (`/api/webhooks/stripe`) maps statuses through `toSubscriptionStatus()` (fails closed — `paused`/unknown → `past_due`). Unpaid committees are redirected to `/app/subscribe`.

---

## Testing & CI

```bash
npm test        # vitest — unit tests in lib/__tests__/
npm run lint    # eslint (flat config)
npx tsc --noEmit
```

Tests cover the compliance-critical pure logic: SEEC status, the Anedot CSV parser, contribution limits, event-letter assignment, and Form 20 population (exercised against the real template). GitHub Actions runs lint + type check + tests on every push and PR (`.github/workflows/ci.yml`).

---

## Deployment

Hosted on Vercel (`npx vercel --prod`, or connect the repo for auto-deploy). `postinstall` runs `prisma generate` during the build. Set the production env vars in Vercel — `PLAID_ENV=production`, a production `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL` pointing at the deployed domain — and register the Stripe/Anedot webhook URLs against that domain. Add the production `/auth/callback` URL to Supabase's redirect allowlist.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run the unit tests |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:push` | Push schema to the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed initial committee data |
