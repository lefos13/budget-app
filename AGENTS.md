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

---

## 4. Business Logic & Domain Rules
- **Wallets & Memberships**:
  - Wallets have members with roles: `OWNER`, `MEMBER`, `VIEWER`.
  - Only `OWNER` can edit wallet budget targets or delete the wallet.
- **Bills vs. Subscriptions vs. Expenses**:
  - `Expense`: Variable daily spending logged against envelopes. Counts against the monthly budget gauge.
  - `InvoiceBill (type = 'BILL')`: One-off utility invoices and bills with due dates. When marked as paid, creates an expense record.
  - `InvoiceBill (type = 'SUBSCRIPTION')`: Recurring services (Netflix, Gym, etc.). Subscriptions live on the bills page (`/calendar`), but **MUST NEVER be counted as variable expenses** and **MUST NOT create `Expense` records** when paid.
- **User-Targeted Invitations**:
  - Wallet invites can target an email (`targetEmail`).
  - Only an authenticated user matching `targetEmail` can claim the invite.
  - Pending invitations targeting the user's email appear directly in the user's dashboard with 1-click acceptance.
- **Export / Import**:
  - Full wallet backup via JSON (`/api/wallets/[id]/export` and `/api/wallets/[id]/import`).

---

## 5. Internationalization (i18n)
- The app is bilingual: English (`en`) and Greek (`el`).
- UI text should not be hardcoded in English or Greek. Use `useTranslation()` from `src/context/LanguageContext.tsx` with dictionary keys in `src/lib/i18n/dictionaries/`.
- Active language is saved in `localStorage.getItem('aura_language')`.

---

## 6. Layout & Navigation
- Desktop layout uses an expandable/collapsible left sidebar (`src/components/sidebar.tsx`), width transitioning between `w-64` (expanded) and `w-20` (collapsed).
- Mobile layout uses a responsive top header and drawer/navigation.

---

## 7. Verification & Testing
Before committing changes or concluding tasks:
1. Verify database schema: `npx prisma validate`.
2. Run automated test suite: `npx tsx scripts/test-e2e.ts`.
3. Check build and TypeScript types: `pnpm run build` or `pnpm run lint`.

