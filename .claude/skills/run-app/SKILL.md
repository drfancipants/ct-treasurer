---
name: run-app
description: Launch and drive the CT Treasurer app locally — dev server, authenticated headless-browser session, and API testing with signed webhooks. Use when asked to run the app, screenshot pages, test flows end-to-end, or verify a change in the real app.
---

# Running and driving the CT Treasurer app

## Dev server

```bash
npm run dev > /tmp/dev.log 2>&1 &
echo $! > /tmp/dev.pid
timeout 60 bash -c 'until curl -sf http://localhost:3000/login >/dev/null; do sleep 1; done'
```

Stop with `kill $(cat /tmp/dev.pid)` — if children linger, `pgrep -f "next dev|next-server" | xargs -r kill -9`. Don't run `next build` while the dev server is up (both write `.next/`).

## Authenticated browser session

Auth is Supabase magic-link; there is no test password. Mint a session cookie
server-side with the service role key:

```bash
node .claude/skills/run-app/scripts/mint-session.js [email] > /tmp/session.json
```

Defaults to `tfanciullo@gmail.com`. Output is `{ name, value }` — the
`sb-<ref>-auth-token` cookie. Set it on `localhost` in Playwright:

```js
const { chromium } = require('playwright-core') // npm i playwright-core in a scratch dir
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'
const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const cookie = JSON.parse(fs.readFileSync('/tmp/session.json', 'utf8'))
await ctx.addCookies([{ ...cookie, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
```

The same cookie works for API routes: `Cookie: ${name}=${value}` header on `fetch`.

Committee slugs: the minted user's only membership is `gdtc` (committee id
`cmr5lgmwj00008tilcfwsle9g`) — use that one. Other committees may exist in the
local DB (e.g. `guilford-dtc`) but the user is not a member, so authenticated
requests against them 403. Authenticated pages live at
`/app/<slug>/{dashboard,donations,expenses,bank,filings,members,settings}`.

When seeding throwaway rows for a drive, tag them (memo/notes field) and
delete by tag afterward.

## Gotchas (all hit in practice)

- **supabase-js on Node 20** needs a WebSocket polyfill before import —
  `mint-session.js` shows the pattern (`globalThis.WebSocket = require('ws')`).
- **Prisma scripts** need env loaded manually: `.env` has `DATABASE_URL`;
  parse it yourself, `dotenv` is not installed.
- **Playwright selects**: list pages have *filter* `<select>`s above the
  dialogs — `page.locator('select').first()` usually grabs a filter, not the
  dialog field. Scope to the dialog or use `.nth()` after counting.
- **Row menus**: `page.locator('tr:has-text("...") button').last().click()`
  opens the per-row ⋯ menu; then click `button:has-text("Edit")` etc.
- **Downloads**: `browser.newContext({ acceptDownloads: true })` +
  `page.waitForEvent('download')` for the Form 20 export.
- The dark "N" circle bottom-left in screenshots is the Next.js dev-tools
  button, not an app element.

## Signed webhook testing

- **Anedot** (`/api/webhooks/anedot`): HMAC-SHA256 hex of the raw body with
  `ANEDOT_WEBHOOK_SECRET`, sent as `X-Request-Signature` (Anedot's real header).
  Body is Anedot's default template: `{ event: 'donation_completed', payload:
  { account_uid, amount_in_dollars, first_name, …, donation: { id, … } } }` —
  see the sample in `lib/__tests__/anedot-webhook.test.ts`. Routes to a
  committee by `payload.account_uid` → `Committee.anedotAccountId`. Idempotent
  by `payload.donation.id`. Non-`donation_completed` events are 200-skipped.
- **Stripe** (`/api/webhooks/stripe`): sign with
  `stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_WEBHOOK_SECRET })`,
  send as `stripe-signature`. Use a throwaway committee row; delete it after.

## Test-data hygiene

Anything created during a drive should be deleted afterward via Prisma
(`contribution`/`contributor`/`expenditure`/`seecFiling` deleteMany on the
test ids/emails). Plaid sandbox transactions on Madison's accounts are fine to
keep — they're the reconcile-flow fixture. Stripe key is test-mode (`sk_test_`).
