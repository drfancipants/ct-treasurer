# Admin toolbox

Operator-only scripts for the support tasks the app deliberately has no UI
for. There is no in-app super-admin role — every app route is tenant-scoped —
so platform administration happens here (plus the Supabase, Stripe, and Vercel
dashboards).

```bash
npm run admin -- <command> [args] [--prod] [--yes]
```

## Commands

| Command | What it does | Mutates |
| --- | --- | --- |
| `list-committees` | Committees with type, subscription status, member/record counts, last activity | no |
| `list-users` | App users with memberships, last sign-in, email confirmation, MFA factor counts; flags auth users missing an app `User` row | no |
| `unlock-mfa <email>` | Lists a user's TOTP factors. Add `--delete` to remove them all — **the only recovery path for a user locked out of MFA** (there are no recovery codes). Covers stale unverified factors that block re-enrollment too. | with `--delete` |
| `set-subscription <slug> <status>` | Sets `subscriptionStatus` (`trialing\|active\|past_due\|canceled`); optional `--trial-ends=YYYY-MM-DD` to extend a trial. Warns if the committee has a live Stripe subscription (the next webhook would overwrite a manual status). | yes |

Examples:

```bash
npm run admin -- list-committees --prod
npm run admin -- unlock-mfa treasurer@example.com --prod            # dry run: lists factors
npm run admin -- unlock-mfa treasurer@example.com --prod --delete --yes
npm run admin -- set-subscription gdtc active --trial-ends=2026-12-31
```

## Targeting

- **Default (no flag): local dev database** — reads `.env.local` / `.env`.
- **`--prod`: production** — reads `.env.prod`, which you must create by hand
  (Vercel stores the production secrets as *Sensitive* vars, which
  `vercel env pull` returns as empty strings). It is covered by the `.env*`
  gitignore rule — never commit it. It needs exactly:

  ```bash
  # from the production Supabase project: Settings → Database
  DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"
  # from Settings → API
  NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...
  ```

  (Deliberately named `.env.prod`, **not** `.env.production.local` — Next.js
  loads the latter during `next build`, which would silently point local
  production builds at the live database.)

Every run prints the target database and auth hosts first — check the banner
before reading results. Mutating commands (`unlock-mfa --delete`,
`set-subscription`) additionally require `--yes` when `--prod` is set.
