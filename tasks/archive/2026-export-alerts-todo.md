# Task List — Wallet export/import fidelity + Alerts screen

Plan and rationale: `tasks/plan.md`. Status: **IMPLEMENTED and verified (pnpm test, lint, build).** Old plan: `tasks/archive/`.

Standard verification (AGENTS.md §7), referred to as **STD**:
- `npx prisma validate`
- `npx tsx scripts/test-e2e.ts` (and `pnpm test` for the full set)
- `pnpm run lint`
- `pnpm run build`
- Manual: `pnpm dev`, drive the UI in the browser; check both `authMode` values and both languages for any UI change.

Every task: read the relevant `node_modules/next/dist/docs/` guide first (AGENTS.md); new UI text via `useTranslation()` keys in **both** `en.ts` and `el.ts`; never reset/wipe the DB; no schema change is planned.

---

## Phase 1 — Data fidelity

### T1: Export v2 and import restore of expenses, bills/subscriptions, planned expenses
**Description:** Bump export to `version: '2.0'` (additive). Add per-record `ref`, `createdAt`, author `userName/userEmail`; export **all** planned expenses (any status) with `status` and `realizedExpenseRef`; export `expenses[].invoiceRef`, `invoices[].paidBy{name,email}`. Import rebuilds links via a ref→newId map (order: categories → invoices → expenses → planned), restores `status`, `paidAt`, `paidByUserId`, `createdAt` where valid, maps author by email to an existing wallet member else the importer. Validate/normalise `status` (`PENDING|PAID|OVERDUE`) and ignore unknown link refs. v1.0 files keep importing unchanged. Add `scripts/test-wallet-roundtrip.ts` (added to `pnpm test`).
**Acceptance criteria:**
- [x] Export JSON of a wallet with paid + unpaid bills, a subscription, a paid-bill expense, a PENDING and a REALIZED planned expense contains all of them, with links and statuses.
- [x] Import of that file into a new wallet yields equal counts per entity, identical totals, the paid-bill expense linked to its bill (paying the bill again creates no second Expense), and the REALIZED planned expense linked to its expense with status REALIZED.
- [x] A v1.0 file and a file with only `expenses` still import with the old behaviour (200, sensible counts).
- [x] Malformed rows (bad date, non-numeric amount, dangling refs, invalid status) are skipped/normalised, not a 500.
- [x] Permissions unchanged: export = any member; import = OWNER/MEMBER, VIEWER 403; unauth 401.
**Verification:**
- [x] `npx tsx scripts/test-wallet-roundtrip.ts` (DB test using throwaway wallets, deleted afterwards) compares (title, amount, date) tuples and link integrity, not ids.
- [x] STD; manual export → import via Wallet page in the browser.
**Dependencies:** None
**Files likely touched:** `src/app/api/wallets/[id]/export/route.ts`, `src/app/api/wallets/[id]/import/route.ts`, `scripts/test-wallet-roundtrip.ts` (new), `package.json`
**Estimated scope:** Medium (4 files)

### T2: Activity history in export/import, atomic import, accurate summary in UI
**Description:** Export **all** `ActivityLog` rows (query independently of the wallet route's `take: 10`) as `activityLogs[]` (`action, details, timestamp, userName, userEmail`). Import recreates them with original `timestamp`, attributed by email-match else importer (original author name appended to `details` when unmatched), plus the existing `DATA_IMPORTED` log. Wrap the whole import in one `prisma.$transaction` (raised timeout) so any failure rolls back everything. `ImportWalletModal` / wallet page show counts for all entity types including planned expenses and history (en + el).
**Acceptance criteria:**
- [x] Exported file includes every activity row of the wallet (not just 10), chronologically.
- [x] Imported wallet's history shows the original entries with original dates plus one `DATA_IMPORTED` entry.
- [x] Forced failure mid-import (e.g. test hook / invalid FK) leaves the target wallet with **zero** new rows.
- [x] 2,000 expenses + 500 bills import completes without timeout.
- [x] Import result panel lists categories, expenses, bills/subscriptions, planned expenses, history counts in en and el.
**Verification:**
- [x] Extend `scripts/test-wallet-roundtrip.ts`: history parity, rollback case, size case.
- [x] STD; manual import in both languages.
**Dependencies:** T1
**Files likely touched:** `src/app/api/wallets/[id]/export/route.ts`, `src/app/api/wallets/[id]/import/route.ts`, `src/components/modals/import-wallet-modal.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`, `scripts/test-wallet-roundtrip.ts`
**Estimated scope:** Medium (5 files + dictionaries)

### Checkpoint 1: After T1–T2
- [x] `pnpm test`, `npx prisma validate`, lint, build pass
- [x] Manual export → import into a fresh wallet reproduces expenses, bills, subscriptions, planned, history; v1 file still imports
- [x] Existing `dev.db` row counts unchanged apart from throwaway test data (removed)
- [x] Review with human before proceeding

---

## Phase 2 — Alerts screen

### T3: `/alerts` page with both sections and a sidebar/mobile badge
**Description:** New pure `src/lib/bill-alerts.ts` (urgent bills today-based, unpaid-for-selected-month + carry-over, distinct alert count, `hasOverdue`), extracted from the two banner components. New `src/app/alerts/page.tsx` renders two sections ("Due soon" using existing urgent logic/actions, "Unpaid this month" with `MonthSwitcher`, carry-over and Mark-as-paid) by reusing the existing banner components' logic (extract into section components rather than duplicating). Sidebar gets an **Alerts** nav item (bell icon) with the count badge (red if overdue, amber otherwise, hidden at 0, `99+` cap), correct in collapsed and expanded states; mobile topbar gets a bell with the same badge linking to `/alerts`; drawer/bottom nav entry as well. Empty state when nothing needs attention.
**Acceptance criteria:**
- [x] Clicking the badge/nav item opens `/alerts`; direct URL and reload work in both auth modes.
- [x] Badge count equals the number of distinct unpaid urgent ∪ selected-month-unpaid items; updates immediately after Mark as paid, and when the month changes.
- [x] Both sections show the same items/amounts/actions the banners showed before; Mark as paid (incl. past-month `paidDate`) still works.
- [x] Badge hidden when 0; red when any overdue; readable in light/dark, collapsed↔expanded, 375px mobile.
- [x] Unit tests for `bill-alerts.ts` (today boundaries, carry-over, subscription, paid excluded, dedupe of overlap).
**Verification:**
- [x] `scripts/test-bill-alerts.ts` (DB-free, run under `TZ=Europe/Athens` and `TZ=UTC`), added to `pnpm test`.
- [x] STD; browser screenshots: desktop expanded/collapsed, mobile topbar, `/alerts` with 0, 3 and 30 items.
**Dependencies:** None (Phase 1 independent)
**Files likely touched:** `src/lib/bill-alerts.ts` (new), `src/app/alerts/page.tsx` (new), `src/components/urgent-reminders-banner.tsx`, `src/components/unpaid-bills-banner.tsx`, `src/components/sidebar.tsx`
**Estimated scope:** Medium–Large (5 files + dictionaries + test); split sidebar badge (T3b) if it grows.

### T4: Remove inline banners from dashboard and calendar; compact alert lists
**Description:** Delete `UrgentRemindersBanner`/`UnpaidBillsBanner` usage from `src/app/page.tsx` and `src/app/calendar/page.tsx` (clean cutover: no dead imports, no aliases). On `/alerts`, cap each list's height (scroll inside, "show all" expander past 5 rows) so the page itself stays compact. Leave `PendingInvitesBanner` as-is. Apply Q4 outcome (default: nothing on dashboard).
**Acceptance criteria:**
- [x] Dashboard and calendar no longer render either alert block; layout shifts up cleanly, no empty gap.
- [x] No references to removed inline usage remain (`grep`), lint clean.
- [x] `/alerts` with 30 items stays within one viewport per section (internal scroll or expander), keyboard accessible.
- [x] Calendar list view and other unpaid indicators unchanged.
**Verification:** STD; browser screenshots of dashboard + calendar before/after (with ≥5 overdue items).
**Dependencies:** T3
**Files likely touched:** `src/app/page.tsx`, `src/app/calendar/page.tsx`, `src/app/alerts/page.tsx`, `src/components/urgent-reminders-banner.tsx`, `src/components/unpaid-bills-banner.tsx`
**Estimated scope:** Medium (5 files)

### T5: i18n parity, both auth modes, full regression
**Description:** Verify all new strings exist in en + el (nav label, page title, section titles, empty state, aria-labels for badge like "3 alerts"); run i18n checker; walk mock and normal modes; both languages; desktop and mobile; update README if it documents navigation/export format; remove throwaway data/scripts.
**Acceptance criteria:**
- [x] `pnpm i18n:check` = 0 violations; en/el key parity.
- [x] Alerts flow works in mock (user switching) and normal mode; a VIEWER sees alerts but cannot mark as paid (or button hidden) — behaviour matches previous banner.
- [x] Export format v2 documented (README or `docs`), incl. what is intentionally excluded (members, invites).
- [x] No console errors on `/`, `/calendar`, `/alerts`, `/wallet`.
**Verification:** `pnpm test`, `npx prisma validate`, `pnpm run lint`, `pnpm run build`; browser walkthrough with screenshots.
**Dependencies:** T1–T4
**Estimated scope:** Small

### Checkpoint 2: Complete
- [x] All acceptance criteria met
- [x] `pnpm test`, lint, build pass; no scratch data left in `dev.db`
- [x] Ready for review
