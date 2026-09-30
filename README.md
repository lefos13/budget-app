# Aura Budget

Collaborative monthly budget app (Next.js 16, Prisma + SQLite, English/Greek).

## Key behaviours

- **Selected month** – the month switcher (dashboard, calendar, expenses) is global and persisted in `localStorage['aura_selected_month']`. `GET /api/wallets/[id]?month=YYYY-MM` returns that month's expenses, planned expenses and metrics.
- **Planned expenses** – expenses you know will happen later in a month. They never count as spent until you press "Mark as spent" (creates a real `Expense`, exactly once).
- **"If everything is paid" projection** (`src/lib/month-projection.ts`) – `budget − spent − pending planned − bills due − subscriptions due − carry-over`. A bill is *unpaid as of month end* until it has a linked expense (or legacy `PAID` status) dated on/before that month end, so an unpaid bill from an earlier month is carried into every later month until it is paid. Paying it from its own month (the UI passes `paidDate` inside that month) removes the extra from all later months. Subscriptions due in the month always count (they never create expenses). The result is not clamped.
- **Bills, subscriptions and recurrence** – paying a recurring row creates the next occurrence (`src/lib/recurrence.ts`, month-end clamping). Expenses created by paying a bill are linked via `Expense.invoiceId`. Subscriptions never create `Expense` rows.
- **Roles** – only the wallet `OWNER` edits wallet settings, category names and monthly limits; `MEMBER` can add/edit expenses, bills and planned expenses; `VIEWER` is read-only.
- **Categories & limits** – manage them on *Wallet & Team*; deleting a category keeps its expenses/bills (uncategorised).

## Internationalisation

All UI text lives in `src/lib/i18n/dictionaries/en.ts` and `el.ts`. `pnpm i18n:check` (also part of `pnpm test`) fails on hardcoded user-visible strings, missing Greek keys and mismatched `{placeholders}`. Server error messages shown to users are mapped in `src/lib/i18n/api-errors.ts`. Known limitation: activity-log *detail* sentences are stored in English when written (titles are translated).

## Tests

```bash
pnpm test        # e2e data checks + DB-free unit tests + i18n gate
pnpm test:api    # HTTP API tests; needs `pnpm dev` running (creates and removes temporary rows)
npx prisma validate
```

Database changes are additive migrations only (`prisma migrate deploy`); never reset `prisma/dev.db`.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
