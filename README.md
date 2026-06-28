# CT Committee Treasurer Suite

Campaign finance management and SEEC compliance for Connecticut town committees.

## What it does

- **Dashboard** — monthly raised/spent charts, cumulative balance, expense breakdown, SEEC compliance status
- **Members** — committee roster with role-based access; invite new members by email via Supabase
- **Donations** — manual entry, Anedot webhook ingestion, CSV import; per-contribution SEEC compliance indicators
- **Expenses** — expenditure tracking with SEEC purpose codes; net balance (raised − spent)
- **Bank accounts** — Plaid-powered bank link; transaction reconciliation matched to contributions and expenses
- **SEEC filings** — one-click generation of the eCRIS Form 20 upload template, pre-filled with Sections A (small contributors), B (itemized contributions), and P (expenses)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth (email/password + magic link) |
| Charts | Recharts |
| Bank sync | Plaid |
| CSV parsing | PapaParse |
| Excel generation | SheetJS (xlsx) |
| Validation | Zod |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret) |
| `DATABASE_URL` | Supabase → Settings → Database → Connection pooler |
| `DIRECT_URL` | Supabase → Settings → Database → Direct connection |
| `ANEDOT_WEBHOOK_SECRET` | Generate a random string; enter same value in Anedot |
| `PLAID_CLIENT_ID` | dashboard.plaid.com |
| `PLAID_SECRET` | dashboard.plaid.com (use sandbox for dev) |
| `PLAID_ENV` | `sandbox` for dev, `production` for live |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |

### 3. Create a separate `.env` file for Prisma

> **Why two files?** Next.js reads `.env.local` at runtime, but the Prisma CLI only reads `.env` when you run commands like `db push`. Both files need to exist.

**Mac / Linux:**
```bash
cp .env.example .env
```

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

Then open `.env` and set just the two database variables (same values as in `.env.local`):

```dotenv
DATABASE_URL=postgresql://postgres.YOUR_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.YOUR_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Find both strings in Supabase → **Settings → Database → Connection string**, choosing **Supabase** format. `DATABASE_URL` uses port `6543` (connection pooler); `DIRECT_URL` uses port `5432` (direct connection). Do not wrap the values in quotes.

Make sure `.env` is listed in `.gitignore` so your password is never committed:

**Mac / Linux:**
```bash
echo ".env" >> .gitignore
```

**Windows PowerShell:**
```powershell
Add-Content .gitignore "`n.env"
```

### 4. Set up the database

```bash
npx prisma generate    # generate the Prisma client
npx prisma db push     # push schema to Supabase
```

### 5. Run the dev server

> **Supabase key compatibility:** If you are using Supabase's new `sb_publishable_` / `sb_secret_` key format, you need `@supabase/ssr` v0.5+ and `@supabase/supabase-js` v2.49+. If you see `Auth session missing` errors after a successful login, run:
> ```powershell
> npm install @supabase/supabase-js@latest @supabase/ssr@latest
> ```

### 5. Run the dev server

```bash
npm run dev
# → http://localhost:3000
```

> **No database yet?** The app ships with mock data (`lib/mock-data.ts`) and runs immediately without any environment variables. Pages use mock data by default with `// TODO: replace with Prisma query` markers where the real queries go.

---

## Project structure

```
ct-treasurer/
│
├── app/
│   ├── login/                    # Sign in (email+password or magic link)
│   ├── accept-invite/            # Invited members complete registration here
│   ├── auth/callback/            # Supabase auth code exchange
│   ├── app/
│   │   ├── page.tsx              # Committee selector
│   │   └── [committeeSlug]/
│   │       ├── layout.tsx        # Sidebar shell
│   │       ├── dashboard/        # Charts and summary
│   │       ├── members/          # Committee roster
│   │       ├── donations/        # Contribution tracking
│   │       ├── expenses/         # Expenditure tracking
│   │       ├── bank/             # Plaid bank sync
│   │       └── filings/          # SEEC Form 20 export
│   └── api/
│       ├── invite/               # POST: send Supabase invite email
│       ├── plaid/
│       │   ├── link-token/       # POST: create Plaid Link token
│       │   ├── exchange-token/   # POST: exchange public_token for access_token
│       │   └── sync/             # POST: pull latest transactions
│       ├── form20/               # (generated client-side; no route needed)
│       └── webhooks/anedot/      # POST: receive real-time donation events
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           # Dark navy nav with user profile + sign out
│   │   └── CommitteeSwitcher.tsx # Committee dropdown
│   ├── members/
│   │   ├── MembersTable.tsx      # Roster with role management
│   │   └── AddMemberDialog.tsx   # Invite by email (calls /api/invite)
│   ├── donations/
│   │   ├── DonationSummaryCards.tsx
│   │   ├── DonationsTable.tsx    # Filterable; SEEC status badges
│   │   ├── AddDonationDialog.tsx # Full SEEC-compliant form
│   │   └── AnedotImportDialog.tsx # 4-step CSV import flow
│   ├── expenses/
│   │   ├── ExpenseSummaryCards.tsx # Net balance card
│   │   ├── ExpensesTable.tsx
│   │   └── AddExpenseDialog.tsx
│   ├── bank/
│   │   ├── BankAccountCard.tsx   # Balance card with sync button
│   │   ├── PlaidLinkButton.tsx   # Opens Plaid Link iframe
│   │   ├── TransactionsTable.tsx # Tabbed: All / Needs review / Matched
│   │   └── ReconcileDialog.tsx   # Match transaction to contribution/expense
│   ├── dashboard/
│   │   ├── DashboardSummaryCards.tsx
│   │   ├── MonthlyChart.tsx      # Grouped bar: raised vs spent
│   │   ├── CumulativeBalanceChart.tsx # Area chart: running balance
│   │   ├── PaymentMethodsChart.tsx    # Donut: check / CC / cash
│   │   ├── ExpenseCategoryChart.tsx   # Horizontal bar by SEEC category
│   │   ├── RecentActivity.tsx    # Latest contributions + expenses feed
│   │   └── SeecWidget.tsx        # Compliance progress bar
│   └── filings/
│       └── Form20ExportDialog.tsx # Period picker + eCRIS .xls download
│
├── lib/
│   ├── types.ts                  # All TypeScript interfaces + getSeecStatus()
│   ├── utils.ts                  # formatCurrency, formatDate, cn, etc.
│   ├── mock-data.ts              # Development data (3 committees, members, donations, expenses, bank)
│   ├── analytics.ts              # Chart data aggregation helpers
│   ├── anedot-csv.ts             # PapaParse-based Anedot CSV parser
│   ├── form20.ts                 # eCRIS Form 20 workbook generator (SheetJS)
│   ├── plaid.ts                  # Plaid API client singleton
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       └── server.ts             # Server Supabase client + admin client
│
├── middleware.ts                 # Route protection + session refresh
├── prisma/schema.prisma          # Full database schema
└── public/
    └── templates/
        └── Form_20_Upload_Template.xls  # Official SEEC eCRIS template
```

---

## Authentication

The app uses Supabase Auth with two sign-in methods:

- **Email + password** — standard credential sign-in
- **Magic link** — passwordless one-click sign-in via email

### Invite flow

Access is invitation-only. The invite flow:

1. Treasurer opens **Members → Add member**, enters name, email, and role
2. App calls `POST /api/invite` → `supabase.auth.admin.inviteUserByEmail()` (requires `SUPABASE_SERVICE_ROLE_KEY`)
3. Supabase sends the invitee an email with a link to `/auth/callback?type=invite`
4. Invitee clicks the link, sets their name and password on `/accept-invite`
5. Their profile is stored in Supabase Auth; `CommitteeMembership` is created in Prisma

---

## SEEC compliance

SEEC requires the following for **itemized contributions ≥ $50**:

| Field | Section B column |
|---|---|
| First + last name | 2, 1 |
| Street address | 4 |
| City, state, ZIP | 5, 6, 7 |
| Employer | 8 |
| Occupation | 9 |
| Date received | 10 |
| Amount | 11 |
| Method code (PC/CA/CD/MO) | 12 |

The `getSeecStatus()` function in `lib/types.ts` evaluates every contribution and returns `compliant`, `missing_info`, or `incomplete`. The result is shown as a colored badge on every row in the donations table and summarized in the dashboard SEEC widget.

### Form 20 export

Click **SEEC Filings → Generate Form 20** to download a pre-filled eCRIS upload template:

- **Section A** — aggregate total of non-itemized (< $50) contributions
- **Section B** — one row per itemized contribution with SEEC method codes (`PC`, `CA`, `CD`)
- **Section P** — one row per expense with SEEC purpose codes (`PRNT`, `POST`, `A-SIGN`, `FNDR`, `OFFICE`, `WEB`, `CNSLT`, `OVHD`, `MISC`, `A-NEWS`)

Upload the resulting `.xls` file at **seec.ct.gov → eCRIS → Upload Report**.

---

## Anedot integration

**Webhook (real-time):** Configure your webhook URL in Anedot → Settings → Integrations:
```
https://your-domain.com/api/webhooks/anedot
```
Set the same secret string in Anedot and in `ANEDOT_WEBHOOK_SECRET`. The handler verifies the SHA-256 HMAC signature and deduplicates by Anedot donation UID.

**CSV import (bulk):** Donations → Import Anedot CSV. Supports all Anedot CSV column name variants, auto-detects format, deduplicates against existing records, and flags SEEC issues before importing.

**Note:** Anedot does not expose a public REST API for pulling donations. The webhook and CSV import are the only available sync methods.

---

## Plaid bank sync

1. Add Plaid credentials to `.env.local` (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`)
2. Go to **Bank accounts** and click **Connect bank account**
3. Authenticate with your bank in the Plaid Link iframe
4. Transactions are pulled via `POST /api/plaid/sync` using cursor-based `transactionsSync`
5. Reconcile each transaction to a contribution or expense in the reconciliation dialog

For development, use Plaid sandbox credentials:
- Username: `user_good` / Password: `pass_good` at any listed institution

---

## Replacing mock data with Prisma

Every page currently imports from `lib/mock-data.ts`. To connect the real database:

1. Configure `DATABASE_URL` and `DIRECT_URL` in `.env.local`
2. Run `npx prisma db push`
3. In each page file, replace the mock import with a Prisma query — the `// TODO: replace with Prisma query` comments mark every location
4. Replace the invite stub in `/api/invite/route.ts` with the Prisma `committeeMembership.create` call (also marked with a TODO)

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npx prisma db push` | Push schema to database |
| `npx prisma studio` | Open Prisma Studio GUI |
