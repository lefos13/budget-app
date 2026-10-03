<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aura Budget — Developer & AI Agent Guidelines

## 1. Project Overview & Architecture
- **Framework**: Next.js 16 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS v4, Lucide React icons, Canvas Confetti.
- **Database & ORM**: SQLite (`prisma/dev.db`) managed via Prisma Client.
- **Package Manager**: `pnpm` (Workspace).

---

## 2. Critical Safety & Database Rules
1. **CRITICAL — NEVER WIPE OR RESET DATABASE**:
   - `npx prisma migrate reset` or any command that drops tables or deletes user records is **STRICTLY PROHIBITED** without prior explicit permission.
   - Always evolve schema using non-destructive migrations (`prisma migrate dev --create-only` or `prisma db push` / `prisma migrate diff`).
   - Keep `prisma/dev.db` safe and intact at all times.

---

## 3. Dual Authentication & Dev Flows
The application supports two execution flows, toggleable in the sidebar / settings:
1. **Mock Dev Flow (`authMode === 'mock'`)**:
   - Simulated user switching without credentials (e.g. Alex Johnson, Jordan Smith).
   - Allows instant multi-user role and permission testing.
   - Identified by `x-user-id` header or `localStorage.getItem('aura_active_user_id')`.
2. **Normal Production Flow (`authMode === 'normal'`)**:
   - Real authentication via `/register` and `/login`.
   - Salted password hashing with Node.js `crypto.scryptSync`.
   - Secure HTTP-only session cookies (`aura_session`) validated in `src/lib/auth.ts` and `src/lib/session.ts`.
   - Authenticated users access only wallets they own or have joined.
   - **Public landing page**: a logged-out visitor on `/` sees the marketing landing page (`src/components/landing/`) instead of being redirected; every other private route still redirects to `/login`. Logout goes to `/`. Mock mode always has a user, so to view the landing page in dev, switch to Normal mode and log out. Landing mockups are pure presentational components with fake data (`landing/mockups/fixture.ts`, labels in the `landingMock` dictionary block) and **MUST NOT** use `useApp()` or real data.
   - **Support links** (GitHub Sponsors / Buy Me a Coffee): URLs live only in `src/lib/support-links.ts`; every surface renders them through `SupportLinkButtons` (`src/components/support/support-link-buttons.tsx`, no `useApp()`). Surfaces: landing `#support` section (+ footer anchor), dashboard `SupportStrip` (last item, subtle, not dismissible), profile `ProfileSupportCard`. Copy lives in `landing.support` (informal Greek, like the rest of the landing) and `support` (formal Greek, like the app); support is voluntary and unlocks nothing.

---

## 4. Business Logic & Domain Rules
- **Wallets & Memberships**:
  - Wallets have members with roles: `OWNER`, `MEMBER`, `VIEWER`.
  - Only `OWNER` can edit wallet budget targets or delete the wallet.
- **Bills vs. Subscriptions vs. Expenses**:
  - `Expense`: Variable daily spending logged against envelopes. Counts against the monthly budget gauge — **only the part not paid from savings** (`amount − savingsFundedAmount`).
  - `InvoiceBill (type = 'BILL')`: One-off utility invoices and bills with due dates. When marked as paid, creates an expense record.
  - `InvoiceBill (type = 'SUBSCRIPTION')`: Recurring services (Netflix, Gym, etc.). Subscriptions and recurring bills are managed on the **Recurring payments** page (`/recurring`, not month-scoped); the Calendar (`/calendar`) shows the month's due items. Subscriptions **MUST NEVER be counted as variable expenses** and **MUST NOT create `Expense` records** when paid.
  - **Recurring series**: paying a recurring bill/subscription rolls it forward into a new row that copies the paid row's `seriesId`. `seriesId` (never the title) identifies a series; anything listing or totalling recurring items per period **MUST** collapse a series to one occurrence (`pickSeriesOccurrences` / `monthlyEquivalent` in `src/lib/recurrence.ts`); the month-independent catalogue (`/recurring`) uses `pickNextOccurrences` (next unpaid occurrence per series, else the latest).
- **Savings buckets** (`SavingsBucket`, append-only ledger `SavingsTransaction`; math in `src/lib/savings.ts`, server rules in `src/lib/savings-server.ts`):
  - Each wallet has one **General** bucket plus sub-buckets (`GOAL`). A sub-bucket **MUST** have ≥1 `PENDING` linked planned expense while `ACTIVE`; every route that can remove the last one (unlink, re-link, delete, realize, date moved into the current/past month) closes it and **MUST** receive a disposition (other active bucket or General) for any leftover (`409 Disposition required` otherwise). Only future-month planned expenses can be linked; bucket names come from the user, targets never do.
  - Bucket balance = Σ ledger amounts; never store a balance column, never let it go negative. `DEPOSIT` counts against that month's budget; transfers, `EXPENSE_DRAW` and manual `ADJUSTMENT_IN/OUT` (General only) are budget-neutral; `BUDGET_BOOST` (General only, explicit user action) raises a month's budget. Sub-bucket money **MUST NEVER** go straight to the monthly budget.
  - Deposits are **not** `Expense` records. Realizing a linked planned expense draws from its bucket first and stores the drawn part in `Expense.savingsFundedAmount`.
- **User-Targeted Invitations**:
  - Wallet invites can target an email (`targetEmail`).
  - Only an authenticated user matching `targetEmail` can claim the invite.
  - Pending invitations targeting the user's email appear directly in the user's dashboard with 1-click acceptance.
- **Month bonuses** (`MonthBonus`; math in `src/lib/month-bonus.ts`):
  - Outside money (bonus, gift...) added to ONE month's budget: `available = monthlyBudget + BUDGET_BOOST + bonus`. `Wallet.monthlyBudget` is the steady baseline and is **never** changed to cover a one-off extra.
  - A bonus is **not** an `Expense`, **not** a savings movement, and does not carry over; only `OWNER` may add/remove (`/api/wallets/[id]/bonuses`). Any place computing a month's budget MUST use `effectiveBudget()`.
- **Export / Import**:
  - Full wallet backup via JSON (`/api/wallets/[id]/export` and `/api/wallets/[id]/import`), format `2.3` (additive): includes savings buckets, ledger and links, month bonuses, and invoice `seriesRef` (older files fall back to grouping recurring invoices by type + title); import is atomic and re-enforces the savings invariants.

---

## 5. Internationalization (i18n)
- The app is bilingual: English (`en`) and Greek (`el`).
- UI text should not be hardcoded in English or Greek. Use `useTranslation()` from `src/context/LanguageContext.tsx` with dictionary keys in `src/lib/i18n/dictionaries/`.
- Active language is saved in `localStorage.getItem('aura_language')`.

---

## 6. Layout & Navigation
- Desktop layout uses an expandable/collapsible left sidebar (`src/components/sidebar.tsx`), width transitioning between `w-64` (expanded) and `w-20` (collapsed).
- Mobile layout uses a responsive top header (height `--app-header-h` in `globals.css`), a drawer, and a bottom bar.
- **Navigation registry**: `src/lib/navigation.ts` (`NAV_GROUPS`, `isMonthScopedPath`) is the single source of menu items, their groups (Monthly view / Recurring / Manage), bottom-bar membership (`mobileBar`) and which routes depend on the selected month (`monthScoped`). Add new pages there; never hard-code nav lists or month-scoped route checks elsewhere. The same file owns public-route rules (`isAuthPath`, `isPublicPath`, `isLandingView`, `isSplashView`); `AppShell` (`src/components/app-shell.tsx`, rendered by `layout.tsx`) is the only place that decides whether the app chrome (sidebar, month bar, padded `<main>`) is shown.
- **Month selection**: the global `MonthContextBar` (`src/components/month-context-bar.tsx`, rendered once by `AppShell`) is the only month picker; it shows on month-scoped routes only. Pages read `selectedMonth` from `useApp()` and **MUST NOT** render their own `MonthSwitcher`.

---

## 7. Verification & Testing
Before committing changes or concluding tasks:
1. Verify database schema: `npx prisma validate`.
2. Run automated test suite: `npx tsx scripts/test-e2e.ts`.
3. Check build and TypeScript types: `pnpm run build` or `pnpm run lint`.

