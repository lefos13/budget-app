# Aura Budget

Collaborative monthly budget app (Next.js 16, Prisma + SQLite, English/Greek).

## Key behaviours

- **Landing page** – logged-out visitors (Normal auth mode) get a public landing page on `/` (`src/components/landing/`) with coded product mockups, features, FAQ and sign-up / log-in calls to action. Logged-in users get the dashboard on `/`; logout returns to the landing page. Route rules live in `src/lib/navigation.ts` (tested by `scripts/test-navigation.ts`).
- **Selected month** – one global month bar (`src/components/month-context-bar.tsx`) sits at the top of the month-scoped pages (Overview, Alerts, Expenses, Savings, Calendar; list in `src/lib/navigation.ts`) and is persisted in `localStorage['aura_selected_month']`. `GET /api/wallets/[id]?month=YYYY-MM` returns that month's expenses, planned expenses and metrics.
- **Planned expenses** – expenses you know will happen later in a month. They never count as spent until you press "Mark as spent" (creates a real `Expense`, exactly once).
- **"If everything is paid" projection** (`src/lib/month-projection.ts`) – `budget + extra from General − spent − saved into savings − savings contributions still due − pending planned − bills due − subscriptions due − carry-over`. A bill is *unpaid as of month end* until it has a linked expense (or legacy `PAID` status) dated on/before that month end, so an unpaid bill from an earlier month is carried into every later month until it is paid. Paying it from its own month (the UI passes `paidDate` inside that month) removes the extra from all later months. Subscriptions due in the month always count (they never create expenses). The result is not clamped.
- **Savings** (`/savings`, math in `src/lib/savings.ts`, ledger in `SavingsTransaction`) – each wallet has a **General savings** pool plus **sub-buckets**. A sub-bucket exists only while it has ≥1 pending planned expense linked to it ("Save for this" on a planned expense in a future month). Its **monthly contribution** = per expense `(amount − saved so far) ÷ months left` (months before the due month; saved money fills the earliest expense first; rounded up to the cent), shown as "Savings this month" on Overview and Expenses. **Save** records a deposit that counts against that month's budget (not an `Expense`); extra deposits lower future contributions. **Mark as spent** on a linked expense pays from the bucket first — the `Expense` keeps its full amount with `savingsFundedAmount`, and only the shortfall counts in the month. A bucket with no pending expense left closes; any leftover must go to another bucket or General (never straight to the budget). General money can be moved into buckets, used as **extra budget** for a month (explicit action only), or adjusted manually (money from/to outside the app; budget-neutral). Moving a linked expense's date into the current or a past month unlinks it.
- **Bills, subscriptions and recurrence** – paying a recurring row creates the next occurrence (`src/lib/recurrence.ts`, month-end clamping). Expenses created by paying a bill are linked via `Expense.invoiceId`. Subscriptions never create `Expense` rows. Subscriptions and recurring bills are managed on **Recurring payments** (`/recurring`): one card per series with its next unpaid occurrence and monthly-equivalent cost, independent of the selected month.
- **Roles** – only the wallet `OWNER` edits wallet settings, category names and monthly limits; `MEMBER` can add/edit expenses, bills, planned expenses and savings; `VIEWER` is read-only.
- **Categories & limits** – manage them on *Wallet & Team*; deleting a category keeps its expenses/bills (uncategorised).
- **Export / import** (`/api/wallets/[id]/{export,import}`, format `2.1`, additive over `2.0`/`1.0`) – includes expenses (with `savingsFundedAmount`), bills/subscriptions, planned expenses (with `savingsBucketRef`), savings buckets, the savings ledger and activity history; links are rebuilt from file-local `ref`s. Import is additive and atomic; an imported General merges into the target's General, and an active bucket without a pending expense is closed with its money moved to General. Members and invites are not exported.
- **Alerts & reminders** (`/alerts`) – dedicated alerts route for urgent invoices (due in ≤3 days or overdue) and unpaid bills/subscriptions for the selected month with carry-over. Accessible via the bell badge in the sidebar navigation, mobile topbar and drawer; the count badge turns red if any alert is overdue, amber otherwise, and hides at 0.

## Internationalisation

All UI text lives in `src/lib/i18n/dictionaries/en.ts` and `el.ts`. `pnpm i18n:check` (also part of `pnpm test`) fails on hardcoded user-visible strings, missing Greek keys and mismatched `{placeholders}`. Server error messages shown to users are mapped in `src/lib/i18n/api-errors.ts`. Known limitation: activity-log *detail* sentences are stored in English when written (titles are translated).

## Tests

```bash
pnpm test        # e2e data checks + DB-free unit tests + i18n gate
pnpm test:api    # HTTP API tests; needs `pnpm dev` running (creates and removes temporary rows)
npx prisma validate
```

Database changes are additive migrations only (`prisma migrate deploy`); never reset `prisma/dev.db`. Every schema change needs a committed migration. CI builds its test database from migrations alone, so a `db push`-only change fails the deploy.

Local dev needs a `.env` file (gitignored) containing `DATABASE_URL="file:./dev.db"`. `prisma/*.db` files are gitignored too: databases and their backups stay local. A fresh clone runs `pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts`.

## Production (budget.lnf.gr)

Pushing to `main` runs `.github/workflows/deploy-production.yml`. All of it happens on the GitHub runner except the final step:

1. Lint, typecheck, then `pnpm test` against a fresh SQLite file built from migrations + `prisma/seed.ts`.
2. `next build` with `output: "standalone"` and `NEXT_PUBLIC_AUTH_MODE=normal`.
3. Assemble the release: standalone server, `.next/static`, `public`, `prisma/` and `deploy/`, plus a pinned Prisma CLI in `migrator/`.
4. Smoke test: boot the release in production mode and check that register/session work, and that `/api/users` and `x-user-id` access are rejected.
5. Ship it to the droplet. `deploy/deploy-release.sh` backs up the database, runs `prisma migrate deploy`, swaps the `current` symlink, reloads PM2 (`budget-app`), and checks the health URL.

Production runs with mock auth disabled. When `NODE_ENV=production`, the server ignores `x-user-id`, never falls back to a default user, returns 404 for `/api/users`, and refuses to sign sessions without `AUTH_SECRET`.

Calendar feeds (`/api/wallets/[id]/calendar.ics`) need a per-member secret in `?token=`, because calendar apps can't send cookies. Members get their token from `GET /api/wallets/[id]/calendar-token` (session-authenticated, created on first use) and replace it with `POST`. The Sync .ICS modal has a "Reset link" button for this. A missing or wrong token returns 404. Removing a member deletes their token.

Droplet layout (`/root/budget-app`):

| Path | Purpose |
|---|---|
| `current` | Symlink to the live release, which PM2 runs |
| `releases/<time>-<sha>` | Last 3 releases. Roll back with `ln -sfn` to an older one, then `pm2 reload budget-app` |
| `shared/.env.production` | `NODE_ENV`, `PORT=3200`, `HOSTNAME=127.0.0.1`, `DATABASE_URL=file:/root/budget-app/shared/data/budget.db`, `AUTH_SECRET` |
| `shared/data/budget.db` | Production SQLite database |
| `shared/backups/` | Pre-migration DB copies (last 10) |

nginx (`deploy/nginx/`, live copy in `/etc/nginx/conf.d/budget.lnf.gr.conf`) terminates TLS (Let's Encrypt, renewed by certbot via webroot) and rate-limits `/api/auth/login|register` to 10 requests/min per IP.

GitHub secrets: `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`, `DROPLET_HOST_KEY`, `DEPLOY_PATH` (`/root/budget-app`), and optionally `DROPLET_PORT`.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

