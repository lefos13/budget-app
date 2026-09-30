# Task List — Aura Budget improvements

Plan and rationale: `tasks/plan.md`. Status: **COMPLETE (T1–T23 done and verified; T16 = final regression, build, docs and test-data cleanup done). Open item: Q5 (structured activity-log text), see plan.md.**

Standard verification commands (from AGENTS.md §7), referred to below as **STD**:
- `npx prisma validate`
- `npx tsx scripts/test-e2e.ts`
- `pnpm run lint`
- `pnpm run build`
- Manual: `pnpm dev`, drive the UI in the browser (agent-browser skill); check both `authMode` values and both languages for any UI change.

Every task: read the relevant `node_modules/next/dist/docs/` guide first (AGENTS.md); new UI text via `useTranslation()` keys in **both** `en.ts` and `el.ts`; never reset/wipe the DB.

## Decisions (from review)
- **Q1 yes:** recurring roll-forward is in scope (T15, no longer blocked).
- **Q2 yes:** replace the title-based expense dedupe with a real link (`Expense.invoiceId`, added in T10's migration; pay-route logic in T12).
- **Q3 (revised semantics):** a BILL is committed in month M if `dueDate <= end(M)` and it is *not yet paid as of end(M)* (no linked expense, or linked expense dated after end(M)). So an unpaid bill from an earlier month is counted as an "extra" in **every later month** until it is paid; marking it paid **for its own month** (past month view) removes the extra from all later months. Paid bills whose expense is inside M are already in `spent` (not double counted). Subscriptions due in M always count (they never create Expenses); unpaid subscriptions due before M carry over the same way.
- **Pay for a past month:** `POST /api/invoices/[id]/pay` accepts optional `paidDate`; the created Expense is dated `paidDate` (default today). When paying while viewing a past month the UI passes a date inside that month (the bill's due date), so that month's spend/projection is corrected and the carry-over disappears from later months.
- **Q4:** urgent banner stays today-based; **new** per-selected-month "Unpaid bills" banner (T14) lists the month's unpaid bills/subs with a Mark-as-paid action.
- **Execution:** gemini subagents via Paseo profile **"AGY - subagent"** (`antigravity-cli/gemini-3.8-flash`, accept-edits, thinking high, approvalPolicy skip); same checkout, **sequential phases**; the orchestrator (me) performs the DB schema/migration work (T10 schema+migration step) and reviews every agent's diff + runs STD between tasks.

---

## Phase 1 — Unblockers & quick wins

### T1: Fix auth bootstrap race (reload / direct URL no longer bounces to /login)
**Description:** In normal mode, `AppContext` flips `isLoading=false` on mount (wallet effect with `activeWalletId===null`) before `/api/auth/me` resolves, so the route guard redirects to `/login`. Track user-resolution separately from wallet loading and gate the guard on the former.
**Acceptance criteria:**
- [ ] Normal mode, logged in: hard reload on `/wallet`, `/calendar`, `/expenses`, and a typed URL keeps you on that page (no `/login` flash, no landing on `/`).
- [ ] Normal mode, logged out: visiting a protected URL still redirects to `/login`; `/login`, `/register`, `/invite/*` stay reachable.
- [ ] Logged in + visiting `/login` still redirects to `/`.
- [ ] Mock mode behaviour unchanged.
**Verification:**
- [ ] Step 1 (before editing): reproduce — normal mode, reload `/wallet`, record network (`/api/auth/me` status, `Set-Cookie`) and confirm root cause; if cause differs, update `plan.md` and stop for review.
- [ ] STD (lint/build); manual reload matrix above, incl. a network-throttled reload (slow `/api/auth/me`).
**Dependencies:** None
**Files likely touched:** `src/context/AppContext.tsx`
**Estimated scope:** Small (1 file)

### T2: Wallet dropdown and quick-add menu no longer clipped
**Description:** Menus are `absolute` inside the sidebar's `overflow-y-auto` container and wider than their parent. Restructure so the switcher + quick-add sit outside the scroll region (only nav links scroll), menus are `w-full`, and list height is viewport-aware.
**Acceptance criteria:**
- [ ] With 1, 3 and 12 wallets, the wallet menu is fully visible, not cut at the sidebar edge, list scrolls internally when long, "Create new wallet" stays reachable.
- [ ] Quick-add menu fully visible.
- [ ] Works in light/dark, collapsed↔expanded, and at short viewport heights (e.g. 600px); Esc / outside click still close.
- [ ] Mobile drawer unaffected.
**Verification:**
- [ ] STD lint/build; manual: screenshot each state above.
**Dependencies:** None
**Files likely touched:** `src/components/sidebar.tsx`
**Estimated scope:** Small (1 file)

### T3: Profile page (view/edit) linked from the sidebar
**Description:** Add `/profile`: shows name, email, avatar; edit name + avatar URL; change password in normal mode (verify current password, hash with existing `hashPassword`). Sidebar profile card (desktop expanded/collapsed + mobile drawer) links to it. Works in mock mode (name/avatar only, no password section).
**Acceptance criteria:**
- [ ] Clicking the profile card opens `/profile`; direct URL/reload works (depends on T1).
- [ ] Saving name/avatar updates the sidebar and wallet member lists after refresh.
- [ ] Password change: wrong current password rejected; new password ≥ minimum length enforced (match register rules); old password stops working, new one works.
- [ ] `PATCH /api/auth/me` returns 401 when unauthenticated, never returns `passwordHash`.
- [ ] Strings exist in en + el.
**Verification:**
- [ ] STD; manual: edit name, log out/in with new password; curl `PATCH /api/auth/me` without cookie → 401.
**Dependencies:** T1, T2 (same `sidebar.tsx`)
**Files likely touched:** `src/app/profile/page.tsx` (new), `src/app/api/auth/me/route.ts`, `src/components/sidebar.tsx`, `src/context/AppContext.tsx` (expose `setCurrentUser`/refresh), `src/lib/i18n/dictionaries/{en,el}.ts`
**Estimated scope:** Medium (5 files + dictionaries)

### T4: "Add Subscription" opens the modal on the Subscription type
**Description:** Extend `openAddInvoice(dateStr?, type?)` / `modalInitialType` in context; modal's initial `type` state reads it. Update all subscription entry points (calendar header button, `SubscriptionsSection` add buttons/prop) to pass `'SUBSCRIPTION'`; "Add Bill/Invoice" passes `'BILL'`.
**Acceptance criteria:**
- [ ] "Προσθήκη Συνδρομής"/"Add Subscription" (calendar header and inside the Subscriptions section) opens the modal with Subscription selected, recurrence shown.
- [ ] "Add Bill / Invoice" opens on Bill.
- [ ] Reopening after closing does not keep the previous type; day-agenda "add bill" still works with its date.
**Verification:**
- [ ] STD; manual: click each entry point in both languages, cancel, reopen from the other.
**Dependencies:** None
**Files likely touched:** `src/context/AppContext.tsx`, `src/components/modals/add-invoice-modal.tsx`, `src/app/calendar/page.tsx`, `src/components/calendar/subscriptions-section.tsx`
**Estimated scope:** Medium (4 files)

### Checkpoint 1: After T1–T4
- [ ] Lint + build pass; `npx tsx scripts/test-e2e.ts` passes
- [ ] Normal-mode reload matrix passes; profile page works; dropdown fully visible; subscription button preselects
- [ ] Review with human before proceeding

---

## Phase 2 — Month focus

### T5: Global selected month + month-scoped wallet API + dashboard switcher
**Description:** Add `src/lib/month.ts` (parse/format `YYYY-MM`, local month bounds, local date-key, pacing reference date). `AppContext` gets persisted `selectedMonth` + setters and passes `?month=` on wallet fetch with a stale-response guard. `GET /api/wallets/[id]` scopes expenses/categories/`recentExpenses` to that month and adds `month` and `monthExpenses` (all in month). New `MonthSwitcher` (prev / month picker / next / Today) on the dashboard header. Dashboard cards follow the month: budget card pacing uses the month's reference date (past = complete, future = not started); Upcoming Bills card shows bills due in the selected month; Category/Recent already follow via API. Dashboard uses `isLoading && !walletData` so switching doesn't flash a full-page spinner.
**Acceptance criteria:**
- [ ] Dashboard can move to previous/next months and back to today; the header label shows the chosen month (not hard-coded current).
- [ ] Spent, remaining, category bars, recent expenses, upcoming bills change with the month; a month with no data shows zeros/empty states, not errors.
- [ ] Selection persists across reload and across pages (state is global) and per browser; default is current month.
- [ ] Invalid `?month=` → current month (200, not 500); Dec→Jan and Jan→Dec roll years correctly.
- [ ] Rapid clicking never leaves data from an older month on screen.
- [ ] Sidebar "left" figure follows the selected month.
**Verification:**
- [ ] New DB-free `scripts/test-month.ts` (bounds, Dec/Jan, leap Feb, key helper, run under `TZ=Europe/Athens` and `TZ=UTC`); add to `pnpm test`.
- [ ] STD; manual: click through Aug/Sep/Oct, reload, throttle network and click fast.
**Dependencies:** None (do after Phase 1)
**Files likely touched:** `src/lib/month.ts` (new), `src/components/month-switcher.tsx` (new), `src/context/AppContext.tsx`, `src/app/api/wallets/[id]/route.ts`, `src/app/page.tsx`, `src/components/budget-overview-card.tsx`, `src/components/upcoming-bills-card.tsx`
**Estimated scope:** Large (7 files) — acceptable because one vertical path; if it stalls, split cards into T5b.

### T6: Calendar and Expenses pages follow the global month
**Description:** Remove `MonthGrid`'s local `currentDate`; grid, ribbon stats, list view default and day drawer use the global month and `monthExpenses` (fixes the 8-item `recentExpenses` bug). Expenses API accepts `month`; expenses page lists that month and shows the `MonthSwitcher`.
**Acceptance criteria:**
- [ ] Changing month anywhere changes it everywhere (dashboard ↔ calendar ↔ expenses).
- [ ] Calendar day cells and the agenda drawer show *all* expenses of that day/month, not just the 8 most recent.
- [ ] Bills appear on the correct calendar day in `TZ=Europe/Athens` (no off-by-one) including the 1st and last day of month.
- [ ] Expenses page totals/average/filters operate on the selected month; `limit`/search/category filters still work.
**Verification:**
- [ ] STD; manual with >8 expenses in one month; manual in Athens TZ on 1st/last day.
**Dependencies:** T5
**Files likely touched:** `src/components/calendar/month-grid.tsx`, `src/components/calendar/day-agenda-drawer.tsx`, `src/app/calendar/page.tsx`, `src/app/expenses/page.tsx`, `src/app/api/expenses/route.ts`
**Estimated scope:** Medium (5 files)

### T7: Calendar toolbar — filters and view toggle directly above the calendar
**Description:** Lift `statusFilter` to the calendar page. One toolbar placed immediately above the grid/list containing: type tabs (All/Bills/Subscriptions), status filter, Calendar/List toggle, and `MonthSwitcher`. Remove the duplicate tab bar above the Subscriptions section and the status filter/nav inside `MonthGrid` header; list view uses the same filters (its own search stays inside the list card).
**Acceptance criteria:**
- [ ] Nothing sits between the toolbar and the calendar/list; toolbar is the last element above it.
- [ ] Type, status, view controls each appear once and drive both views consistently.
- [ ] Responsive: wraps cleanly at 375px; no horizontal scroll.
- [ ] Sync .ICS and Add Bill actions remain reachable.
**Verification:**
- [ ] STD; manual screenshots at 1440px and 375px, both views.
**Dependencies:** T6
**Files likely touched:** `src/app/calendar/page.tsx`, `src/components/calendar/month-grid.tsx`, `src/components/calendar/bills-list-view.tsx`
**Estimated scope:** Medium (3 files)

### Checkpoint 2: After T5–T7
- [ ] `pnpm test` (incl. month tests), lint, build pass
- [ ] Month selection is consistent across dashboard/calendar/expenses and survives reload
- [ ] Review with human before proceeding

---

## Phase 3 — Edit bills/subscriptions

### T8: Edit bill/subscription — API, modal edit mode, list-view entry point
**Description:** New `PATCH /api/invoices/[id]` (auth + wallet-membership check, `VIEWER` forbidden, validates fields, recomputes `PENDING/OVERDUE` for unpaid rows, activity log). `AppContext` gets `editingInvoice` + `openEditInvoice(inv)`. `AddInvoiceModal` prefills from it, submits PATCH, title/CTA reflect edit mode; PAID non-subscription rows lock amount/date with a hint. Add an Edit action to `BillsListView` rows.
**Acceptance criteria:**
- [ ] Edit from the list view changes title, amount, due date, category, invoice number, notes, recurrence, reminder days; UI refreshes.
- [ ] Changing a past due date on a PENDING row → OVERDUE; moving to the future → PENDING.
- [ ] Bill ↔ Subscription type switch works and respects the rule "subscriptions never create Expense records".
- [ ] `VIEWER` and non-members get 403; unauthenticated 401; unknown id 404; invalid amount 400.
- [ ] Create mode unaffected; closing edit and opening create shows an empty form.
**Verification:**
- [ ] Extend `scripts/test-backend-features.ts` or a small route-level test for PATCH permission/validation paths; STD; manual edit round trip.
**Dependencies:** T4
**Files likely touched:** `src/app/api/invoices/[id]/route.ts` (new), `src/context/AppContext.tsx`, `src/components/modals/add-invoice-modal.tsx`, `src/components/calendar/bills-list-view.tsx`, dictionaries
**Estimated scope:** Medium (4 files + dictionaries)

### T9: Edit entry points — subscriptions section and day agenda drawer
**Description:** Add Edit buttons to `SubscriptionsSection` rows and `DayAgendaDrawer` bill rows, calling `openEditInvoice`.
**Acceptance criteria:**
- [ ] Edit available (and prefilled correctly) from subscriptions section and agenda drawer; drawer closes/behaves sensibly when the modal opens.
- [ ] Keyboard-accessible with aria-labels in en + el.
**Verification:** STD; manual from each entry point.
**Dependencies:** T8
**Files likely touched:** `src/components/calendar/subscriptions-section.tsx`, `src/components/calendar/day-agenda-drawer.tsx`
**Estimated scope:** Small (2 files)

### Checkpoint 3: After T8–T9
- [ ] All three edit entry points work; permission paths verified; lint/build/tests pass
- [ ] Review with human before proceeding

---

## Phase 4 — Planned expenses & projection

### T10: PlannedExpense schema, migration, API, month payload
**Description:** **Orchestrator performs the schema + migration step** (backup `dev.db` first; never `migrate reset`); a gemini agent then builds the API on top. Add `PlannedExpense` (`id, walletId, userId, categoryId?, title, amount, expectedDate, notes?, status PENDING|REALIZED, realizedExpenseId?, createdAt, updatedAt`) with relations on Wallet/User/Category, **and** nullable `Expense.invoiceId` (FK to `InvoiceBill`, `onDelete: SetNull`) for Q2. One additive migration via `prisma migrate diff --script` + `migrate deploy`. `POST/GET/PATCH/DELETE /api/planned-expenses` (membership check, `VIEWER` read-only, month filter). Wallet GET returns `plannedExpenses` for the selected month.
**Acceptance criteria:**
- [ ] `npx prisma validate` passes; existing rows in `dev.db` intact (row counts before/after equal).
- [ ] CRUD works; validation (title, positive amount, date); 401/403/404 paths.
- [ ] Planned rows do **not** appear in any existing total (spent, category spend, calendar sums, expenses page).
- [ ] Deleting a wallet cascades planned rows.
**Verification:**
- [ ] Record `SELECT count(*)` for every table before/after; STD; curl the CRUD + permission cases; extend `scripts/test-e2e.ts` with a planned-expense create/delete round trip.
**Dependencies:** T5
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_planned_expenses/migration.sql` (new), `src/app/api/planned-expenses/route.ts` (new), `src/app/api/wallets/[id]/route.ts`, `scripts/test-e2e.ts`
**Estimated scope:** Medium (5 files)

### T11: Create and list planned expenses in the UI
**Description:** "Planned" toggle in `AddExpenseModal` (expected date instead of spent date, submits to planned API). Expenses page gets a "Planned / Upcoming" section for the selected month (title, date, category, amount, delete) with subtotal. `AppContext` types include `plannedExpenses`.
**Acceptance criteria:**
- [ ] User can add a planned expense for any date/month; it appears in the Planned section of that month only.
- [ ] Delete works; empty state; totals in en/el; currency formatting via `formatCurrency`.
- [ ] Regular expense creation unchanged.
**Verification:** STD; manual add/delete across two months.
**Dependencies:** T10
**Files likely touched:** `src/components/modals/add-expense-modal.tsx`, `src/app/expenses/page.tsx`, `src/context/AppContext.tsx`, dictionaries
**Estimated scope:** Medium (3 files + dictionaries)

### T12: Realize a planned expense; include in export/import
**Description:** `POST /api/planned-expenses/[id]/realize` — one transaction: create `Expense` (date = today unless supplied, amount editable), mark planned `REALIZED` + `realizedExpenseId`. "Mark as spent" button in the Planned section. Export/import include planned expenses (format stays backward compatible; old files import fine). **Also (Q2/Q3):** change `POST /api/invoices/[id]/pay` to (a) dedupe by `Expense.invoiceId` instead of title, (b) accept optional `paidDate` used as `paidAt` and the Expense date, (c) stay a no-op on already-PAID rows, (d) keep "subscriptions never create Expense". Existing paid bills without a link keep working (no backfill required).
**Acceptance criteria:**
- [ ] Realizing moves the amount from "planned" into "spent" exactly once (double click / repeat request is idempotent, 409 or no-op).
- [ ] Export → import into a new wallet reproduces planned items; importing a pre-change export file still works.
- [ ] Paying a same-titled bill in a later month creates its own Expense; paying the same invoice twice creates one Expense.
- [ ] `paidDate` inside a past month puts the Expense in that month (spent for that month changes, current month does not); invalid `paidDate` → 400.
**Verification:** STD; test double-realize; export/import round trip in the UI.
**Dependencies:** T11
**Files likely touched:** `src/app/api/planned-expenses/[id]/realize/route.ts` (new), `src/app/expenses/page.tsx`, `src/app/api/wallets/[id]/export/route.ts`, `src/app/api/wallets/[id]/import/route.ts`, `scripts/test-e2e.ts`
**Estimated scope:** Medium (5 files)

### T13: "If everything is paid" projection on the dashboard
**Description:** `src/lib/month-projection.ts` (pure): `projectedRemaining = budget − spent − plannedPending − committedBills − committedSubscriptions` using the **Decisions (Q3 revised)** semantics above (bills unpaid as of end of month incl. carry-over from earlier months; subscriptions due in month always; unclamped). Wallet API returns `metrics.projection` with each component (including a separate `carryOver` amount so the UI can show "of which carried over from earlier months"). New dashboard card under the budget gauge shows the projected remaining with the component breakdown; negative shown in red with "over budget by …".
**Acceptance criteria:**
- [ ] Figures match a hand-calculated example for the seeded wallet (documented in the test).
- [ ] Unpaid bill from an earlier month appears as carry-over in the selected month **and every later month**; after marking it paid for its own month, carry-over disappears from all later months.
- [ ] Paid bill counted once (via Expense in the month it was paid); unpaid bill counted; paid + unpaid subscription due in the month both counted; pending planned counted, realized planned not counted twice.
- [ ] Follows the selected month; negative values render red; zero-data month shows budget unchanged.
- [ ] Existing gauge (`remainingBudget`) semantics unchanged.
**Verification:**
- [ ] DB-free `scripts/test-month-projection.ts` covering each case above (added to `pnpm test`); STD; manual against seeded data.
**Dependencies:** T5, T10, T12
**Files likely touched:** `src/lib/month-projection.ts` (new), `src/app/api/wallets/[id]/route.ts`, `src/components/month-projection-card.tsx` (new), `src/app/page.tsx`, `src/context/AppContext.tsx`, dictionaries, `scripts/test-month-projection.ts` (new)
**Estimated scope:** Medium–Large (6 files + dictionaries); split card vs API if it grows.

### T14: Unpaid-bills banner for the selected month
**Description:** New `UnpaidBillsBanner` shown on the dashboard and calendar page: lists bills/subscriptions due in the **selected month** that are not paid (plus, as a separate line, the count/total carried over from earlier months), each with a Mark-as-paid button. Marking paid while viewing a past month calls the pay route with `paidDate` inside that month; viewing the current/future month uses today. Hidden when nothing is unpaid. Distinct from the existing today-based `UrgentRemindersBanner`.
**Acceptance criteria:**
- [ ] Banner lists exactly the unpaid (PENDING/OVERDUE) items due in the selected month with amounts and total; changes when the month changes.
- [ ] Mark as paid updates the list, the spent/remaining figures and the projection for that month without a page reload.
- [ ] In a past month, marking paid attributes the Expense to that month and removes the carry-over from later months (verified by switching months).
- [ ] Empty state hides the banner; en + el strings; works on mobile width.
**Verification:** STD; manual: leave a bill unpaid in Aug, view Sep (shows as carry-over), go back to Aug, mark paid, return to Sep (carry-over gone) and confirm Aug spent increased, Sep unchanged.
**Dependencies:** T5, T12 (pay route `paidDate`), T13 (carry-over figures)
**Files likely touched:** `src/components/unpaid-bills-banner.tsx` (new), `src/app/page.tsx`, `src/app/calendar/page.tsx`, `src/context/AppContext.tsx`, dictionaries
**Estimated scope:** Medium (4 files + dictionaries)

### Checkpoint 4: After T10–T14
- [ ] `pnpm test`, `npx prisma validate`, lint, build pass; DB row counts preserved
- [ ] Planned → realized → spent flow works; projection matches hand calculation
- [ ] Review with human before proceeding

---

## Phase 5 — Finish

### T15: Recurring subscription roll-forward (approved, Q1)
**Description:** On paying a recurring invoice (subscription or `isRecurring`), create the next PENDING occurrence (next due date by interval, same fields) inside the pay transaction.
**Acceptance criteria:**
- [ ] Paying a monthly subscription creates exactly one next-month PENDING row; repeat pay does not duplicate.
- [ ] Yearly/quarterly/weekly intervals advance correctly (month-end clamping, e.g. Jan 31 → Feb 28/29).
- [ ] Subscriptions still never create `Expense` rows.
- [ ] Paying a row whose next occurrence already exists (e.g. paying an older month later) does not create a duplicate.
**Verification:** unit test for date advance + STD.
**Dependencies:** T8, T12 (same pay route)
**Files likely touched:** `src/app/api/invoices/[id]/pay/route.ts`, `src/lib/recurrence.ts` (new), `scripts/test-e2e.ts`
**Estimated scope:** Small–Medium (3 files)

### T16: Full regression, both auth modes, both languages, docs
**Description:** Walk every acceptance criterion in mock and normal modes, en and el, desktop and mobile; update README if it documents features/setup; delete throwaway scripts.
**Acceptance criteria:**
- [ ] All 8 user requests demonstrated; no console errors.
- [ ] `pnpm test`, `npx prisma validate`, `pnpm run lint`, `pnpm run build` all pass.
- [ ] `git status` shows no unintended `dev.db`/scratch changes staged.
**Verification:** STD + browser walkthrough with screenshots.
**Dependencies:** T1–T15
**Estimated scope:** Small

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

---

## Phase 6 — Added during execution (user requests after plan approval)

**Execution order from here:** finish Phase 2 → Phase 3 → **T17, T18** → Phase 4 → T15 → **T19–T22** → **T16 (regression, always last)**. Rationale: category management is independent of month/projection work; the i18n sweep goes last so every new string from earlier tasks is included.

### T17: Category & limit management API (+ owner-only guard)
**Description:** Today categories (and their `monthlyLimit` "envelopes" shown on the dashboard) can only be created by the register/new-wallet defaults; there is no endpoint or UI to add, rename, re-limit or delete them. Add `POST /api/wallets/[id]/categories`, `PATCH` and `DELETE /api/wallets/[id]/categories/[categoryId]`. **OWNER only** for all writes (AGENTS.md: only OWNER edits budget targets); any member can read via the wallet payload. Validation: name required/trimmed/≤40 chars and unique per wallet (case-insensitive) → 409 on duplicate; `monthlyLimit` null/empty (= no cap) or a number ≥ 0; `color` `#rrggbb`; `icon` string (default `Tag`). Deleting a category must NOT delete expenses/bills/planned expenses — they become uncategorised (`categoryId` → null); do this explicitly in a transaction rather than relying on FK behaviour. Also fix `PATCH /api/wallets/[id]`, which today only blocks `VIEWER` (so MEMBERS and even non-members can change the wallet budget): require OWNER membership, matching the documented rule.
**Acceptance criteria:**
- [ ] OWNER can create/update/delete; MEMBER/VIEWER → 403, non-member → 403/404, unauthenticated → 401.
- [ ] Duplicate name → 409; invalid limit/color → 400; unknown category or category of another wallet → 404.
- [ ] Deleting a category with expenses, bills and planned expenses leaves those rows intact with `categoryId = null`; counts before/after equal.
- [ ] `PATCH /api/wallets/[id]` by a MEMBER → 403 (budget name/currency/color edits by OWNER still work); `activityLog` entries written for category changes.
**Verification:** extend `scripts/test-backend-features.ts` (or a route-level script) with create/update/duplicate/delete + permission cases; STD; curl matrix as OWNER and as MEMBER (use two throwaway users, delete them after).
**Dependencies:** T5 (touches the same wallet route file — do after it)
**Files likely touched:** `src/app/api/wallets/[id]/categories/route.ts` (new), `src/app/api/wallets/[id]/categories/[categoryId]/route.ts` (new), `src/app/api/wallets/[id]/route.ts` (PATCH guard), `scripts/test-backend-features.ts`
**Estimated scope:** Medium (4 files)

### T18: Category & limit management UI
**Description:** New "Categories & Limits" section on the Wallet & Team page (`/wallet`): list each category (color dot/icon, name, monthly limit or "no cap", spent in the selected month), OWNER-only Add / Edit / Delete (modal form: name, color swatches, icon, monthly limit with "no limit" option; delete with confirm that says linked expenses/bills stay uncategorised). Non-owners see the list read-only with no action buttons. Dashboard `CategoryBreakdown` header gets a "Manage limits" link to that section (OWNER only). Changes call `refreshWallet()` so the dashboard envelopes and the expense/bill category dropdowns update immediately. Optional info line: sum of category limits vs the wallet's monthly budget (warn, don't block, when it exceeds).
**Acceptance criteria:**
- [ ] OWNER can add a category with a limit, see it on the dashboard envelopes, edit the limit, then delete it; expenses that used it show as uncategorised.
- [ ] MEMBER/VIEWER see the section read-only; API 403s never surface as a raw error.
- [ ] Validation errors (duplicate name, bad limit) shown inline in the active language; no hardcoded text (en + el keys).
**Verification:** STD; manual as OWNER and as a MEMBER (mock mode user switching), en and el.
**Dependencies:** T17
**Files likely touched:** `src/app/wallet/page.tsx`, `src/components/modals/category-modal.tsx` (new), `src/components/category-breakdown.tsx`, `src/context/AppContext.tsx` (types only if needed), dictionaries
**Estimated scope:** Medium (4 files + dictionaries)

### T19: i18n infrastructure + hardcoded-string checker
**Description:** Add `scripts/check-i18n.ts` (uses the TypeScript compiler API already in devDependencies) that (a) verifies `en`/`el` dictionary key parity and no empty values, and (b) scans `src/**/*.tsx` for user-visible hardcoded strings not passed through `t`: JSX text nodes containing letters, string-literal `title`/`placeholder`/`aria-label`/`alt` attributes, `showToast('…')`/template literals, and `label`/`text` props. Allowlist: brand "Aura", currency/ISO codes, language codes "EN"/"EL", numerals/symbols, and lines tagged `// i18n-ignore: <reason>`. Prints per-file counts; exit 1 while violations exist. Add `"i18n:check": "tsx scripts/check-i18n.ts"` to package.json (do NOT add it to `pnpm test` until T22 brings it to zero). Also make date/relative formatting locale-aware: `formatDate`/`formatRelativeDueDate` in `src/lib/formatters.ts` take a locale (date-fns `el`/`enUS`) and return translated relative text via a dictionary (`Due in N days`, `Due today`, `N days overdue`, …); weekday names and `format(..., 'MMMM yyyy')` usages get the active locale.
**Acceptance criteria:**
- [ ] `pnpm i18n:check` runs and reports the current violations grouped by file (baseline count recorded in the task notes).
- [ ] Checker has its own DB-free tests: catches a JSX literal, an attribute literal, a `showToast('x')` literal, honours `i18n-ignore`, ignores `{t('…')}`.
- [ ] `formatRelativeDueDate`/`formatDate` produce Greek output when the language is `el` (unit-tested), English unchanged.
**Verification:** `npx tsx scripts/check-i18n.ts` output + unit tests; STD.
**Dependencies:** Phases 1–4 done
**Files likely touched:** `scripts/check-i18n.ts` (new), `scripts/test-i18n-check.ts` (new), `src/lib/formatters.ts`, `src/context/LanguageContext.tsx` (locale helper), `package.json`, dictionaries
**Estimated scope:** Medium (5 files + dictionaries)

### T20: i18n sweep — dashboard and its cards
**Description:** Remove every hardcoded user-visible string from `src/app/page.tsx` and dashboard components (`budget-overview-card`, `category-breakdown`, `upcoming-bills-card`, `recent-expenses-card`, `urgent-reminders-banner`, `pending-invites-banner`, `month-projection-card`, `unpaid-bills-banner`) into `en.ts` + `el.ts` (natural Greek). Includes toasts, empty states, tooltips, aria-labels, status texts like "Under budget pace" (returned by `calculateBudgetPacing` — return a key/enum, not English text).
**Acceptance criteria:** `pnpm i18n:check` reports zero violations for these files; switching to EL shows no English on the dashboard (visual check with screenshot); no layout breakage from longer Greek strings.
**Verification:** checker + STD + screenshots in EL at 1440px and 375px.
**Dependencies:** T19
**Files likely touched:** the components listed above + dictionaries
**Estimated scope:** Large (≈9 files + dictionaries) — one agent, but split in two if it stalls.

### T21: i18n sweep — calendar and bills
**Description:** Same for `src/app/calendar/page.tsx`, `components/calendar/*` (month grid incl. weekday names & month title via locale, list view, subscriptions section, day agenda drawer, ICS export modal) and `add-invoice-modal.tsx`. ICS file *content* (event summaries) stays as generated but the modal UI text is translated.
**Acceptance criteria:** checker zero for these files; EL calendar shows Greek weekdays/months/status labels/buttons; screenshots in EL.
**Verification:** checker + STD + EL screenshots (calendar and list views).
**Dependencies:** T19
**Files likely touched:** `src/app/calendar/page.tsx`, `src/components/calendar/*.tsx` (5), `src/components/modals/add-invoice-modal.tsx`, dictionaries
**Estimated scope:** Large (≈8 files + dictionaries)

### T22: i18n sweep — expenses, wallet & team, modals, auth, invites, sidebar, API messages
**Description:** Same for `src/app/expenses/page.tsx`, `src/app/wallet/page.tsx`, `login`, `register`, `invite/[code]`, `profile` leftovers, `sidebar.tsx`, `new-wallet-modal`, `invite-modal`, `import-wallet-modal`, `add-expense-modal`, `category-modal`. API error strings that are shown to users: map known server messages (by exact string / status) to `errors.*` dictionary keys on the client with a translated generic fallback. Activity-log `details` text is stored in English in the DB at write time; the feed renders a translated title from the `action` code and shows the stored details as-is (documented limitation — see Open Question Q5). Finally add `pnpm i18n:check` to the `test` script (must be at zero).
**Acceptance criteria:** `pnpm i18n:check` reports **zero** violations repo-wide; `pnpm test` passes including the checker; EL walkthrough of every page shows no English UI text (except user data and the stored activity details).
**Verification:** checker + `pnpm test` + EL screenshots of every route.
**Dependencies:** T19, T20, T21, T18
**Files likely touched:** the pages/components above + dictionaries + `package.json`
**Estimated scope:** Large (≈12 files) — split into two agents (pages / modals+sidebar) if needed.

### T23: Edit expenses (and planned expenses) — added by user request
**Execution order:** right after T11, before T12 (all three touch `add-expense-modal.tsx` and the expenses page).
**Description:** Expenses can only be created and deleted today. Add `PATCH /api/expenses/[id]` and an edit mode in `AddExpenseModal` (same pattern as bill edit in T8: `editingExpense` in context, prefilled lazily, title/CTA change, PATCH on submit, inline translated errors). Editable fields: title, amount (>0), date, category (must belong to the same wallet), notes. OWNER and MEMBER may edit any expense in the wallet (shared wallet, same as delete today); VIEWER and non-members get 403. Planned expenses (API from T10) get the same treatment in the modal's PLANNED mode: editable while `PENDING`, locked when `REALIZED`. Edit entry points: expenses page rows, dashboard recent-expenses card rows, day-agenda drawer expense rows, and planned rows on the expenses page. Editing never touches invoices: an expense created by paying a bill can be edited but the bill stays as is.
**Acceptance criteria:**
- [ ] Edit from the expenses page changes title, amount, date, category, notes; totals, category envelopes, dashboard and calendar day sums update after refresh; moving the date into another month moves it out of the current month's totals.
- [ ] `PATCH /api/expenses/[id]`: 401 unauthenticated, 404 unknown, 403 VIEWER/non-member, 400 invalid amount/date/category-of-another-wallet; activity log entry `EXPENSE_UPDATED`.
- [ ] Planned expenses: edit while PENDING works; REALIZED rows show no edit action.
- [ ] Create mode unchanged; closing edit then opening create shows an empty form.
**Verification:** new API script `scripts/test-expense-patch.ts` (temp rows, cleanup in finally, counts before/after) added to `test:api`; STD; manual edit round trip + month move.
**Dependencies:** T11
**Files likely touched:** `src/app/api/expenses/[id]/route.ts` (new), `src/context/AppContext.tsx`, `src/components/modals/add-expense-modal.tsx`, `src/app/expenses/page.tsx`, `src/components/recent-expenses-card.tsx`, `src/components/calendar/day-agenda-drawer.tsx`, `scripts/test-expense-patch.ts` (new), dictionaries
**Estimated scope:** Large (7 files + dictionaries) — split API+modal / entry points into two agents.
