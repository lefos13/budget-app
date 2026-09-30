# Implementation Plan: Aura Budget — 8 requested improvements

Status: **COMPLETE — all tasks implemented by gemini subagents (profile "AGY - subagent"), reviewed and verified by the orchestrator. Only Q5 (translating stored activity-log detail sentences) remains open, awaiting the user's decision.**
Task checklist lives in `tasks/todo.md`. No SPEC.md exists; the 8 user requests + `AGENTS.md` are the spec.

## Overview

Eight changes across the Next.js 16 / Prisma(SQLite) app:

| # | Request | Slice(s) |
|---|---------|----------|
| 1 | "Προσθήκη Συνδρομής" opens modal on Subscription tab | T4 |
| 2 | Edit form for bills/subscriptions | T8, T9 |
| 3 | "Incoming expenses" = **planned/upcoming expenses** (confirmed by user) | T10, T11, T12 |
| 4 | Calendar filters + view toggle directly above the calendar | T7 |
| 5 | Dashboard: remaining budget if everything in the month is paid (+ unpaid-bills banner for the month, T14) | T13, T14 |
| 6 | Global month navigation, chosen month applies app-wide | T5, T6 |
| 7 | Wallet dropdown clipped/overflowing | T2 |
| 8 | Profile → redirected to login (**also: no /profile page exists**; user chose "build page + fix redirect") | T1, T3 |

## Findings from reading the code

1. **#8 root cause (code-read, not yet executed → `[INFERENCE]`, T1 reproduces first).**
   `AppContext.tsx:389-407` — on mount `activeWalletId` is `null`, so `loadActiveWallet` calls `setIsLoading(false)` immediately, *before* `initUser` (`/api/auth/me`, :226-260) resolves. The route guard (:263-275) then sees `authMode==='normal' && !currentUser && !isLoading` and does `router.push('/login')`. Login page then sees the user loaded and pushes `/`. Net effect: any hard load / typed URL / reload in normal mode bounces to `/login` and lands on the dashboard. Separately, `/profile` does not exist (`grep` = 0 hits; sidebar profile card is not a link).
2. **#7 root cause.** Wallet dropdown (`sidebar.tsx:481`) is `absolute` inside the `flex-1 overflow-y-auto` middle container (`sidebar.tsx:435`) → clipped by the scroll container. It is also `w-64` inside a ~232px parent (sidebar `w-64` minus `px-3`), so it overflows right. Quick-Add menu (`:567`) has the same defect.
3. **#6 blockers.** Month is hard-coded server-side (`api/wallets/[id]/route.ts:48-50`), in `budget-overview-card.tsx:18-19`, `page.tsx:65`, and `MonthGrid` keeps its own `currentDate` (`month-grid.tsx:38`). `/api/expenses` has no month filter; expenses page loads all-time.
4. **Pre-existing bug that breaks month navigation:** `walletData.recentExpenses` is `slice(0,8)` (`wallets/[id]/route.ts:132`) but `MonthGrid` (:90) and `DayAgendaDrawer` (:46) use it for per-day sums → wrong for any busy month. Needs a full `monthExpenses` list.
5. **`remainingBudget` is clamped** (`Math.max(0, …)`, `wallets/[id]/route.ts:123`); #5 must show negatives → use a separate unclamped `projection`.
6. **Pay route dedupes expenses by title only** (`invoices/[id]/pay/route.ts:41-46`): paying "Electricity" in October creates no Expense if September's exists. This silently understates monthly spend and therefore corrupts #5/#6. See Open Question Q2.
7. **No recurrence roll-forward**: paying a recurring subscription just marks that one row PAID; no next-month row is created, so a monthly subscription does not appear in other months. See Open Question Q1.
8. **Timezone risk.** Calendar keys use `day.toISOString().slice(0,10)` on local-midnight dates (`month-grid.tsx:258`); in UTC+2/+3 this can shift a day. Stored due dates are UTC-midnight. T5 introduces one local date-key helper; T6 verifies in Europe/Athens TZ.
9. i18n: new UI text must go through `useTranslation()` with keys in **both** `dictionaries/en.ts` and `el.ts` (AGENTS.md §5). Existing calendar code hardcodes English in places — only touch strings in code we modify.
10. Existing invoice routes lack membership/role checks (`DELETE /api/invoices`, `pay`). Out of scope, but every **new** route added here MUST check membership and reject `VIEWER` for writes.

## Dependency graph

```
T1 auth bootstrap fix ─┬─► T3 profile page
T2 sidebar dropdown ───┘   (both edit sidebar.tsx → serial)

T4 subscription preselect ─► T8 edit API+modal ─► T9 edit entry points

T5 month state + month-scoped API + dashboard ─┬─► T6 calendar/expenses follow month ─► T7 calendar toolbar
                                               │
                                               └─► T10 planned schema+API ─► T11 planned UI ─► T12 realize + export/import
                                                          │
                                                          └────────────────────────────► T13 projection (needs T5 + T10 + T12)
T12 also changes the pay route (invoiceId link, paidDate) ─► T14 unpaid-bills banner (needs T12 + T13) ─► T15 recurring roll-forward (same pay route)
T16 final regression / docs
```

Bottom-up foundation order: T5 (month) and T10 (schema) are the shared foundations. T1 goes first because normal-mode verification of everything else is unreliable while the bounce exists.

## Architecture decisions

- **Selected month = global app state** in `AppContext` (`selectedMonth: 'YYYY-MM'`, `setSelectedMonth`, prev/next/today helpers), persisted in `localStorage` (`aura_selected_month`) using the same `useSyncExternalStore` pattern already used for `aura_auth_mode` / `aura_language` (avoids hydration mismatch). Default = current month.
- **Server scopes by month**: `GET /api/wallets/[id]?month=YYYY-MM` (invalid/missing → current month). Response adds `month`, `monthExpenses` (all in month), `plannedExpenses` (in month), `metrics.projection`. `invoices` still returns all rows (calendar/list need them); month scoping of invoices is done in the UI/projection.
- **No UI flash on month switch**: pages gate spinner on `isLoading && !walletData`; a stale-response guard (request counter / AbortController) prevents out-of-order results when clicking months quickly.
- **One shared `MonthSwitcher` component** placed on dashboard header, calendar toolbar, expenses header. Single source of truth; no per-page month state (removes `MonthGrid.currentDate`).
- **Pure math in `src/lib/month.ts` and `src/lib/month-projection.ts`** (bounds, keys, projection). Server and UI import the same functions; tested by a DB-free script.
- **Planned expenses = separate `PlannedExpense` model**, not an `Expense.status` flag. Reason: every existing query (`wallet` totals, category spend, expenses page, calendar sums, export) sums `Expense` and would need to remember to exclude planned rows. A separate model cannot pollute them (mirrors how `InvoiceBill` is separate). "Realize" = transaction: create `Expense` + mark planned `REALIZED`.
- **Projection formula (revised per review, Q3):**
  `projectedRemaining = monthlyBudget − spent(Expense in month) − plannedPending(in month) − committedBills − committedSubscriptions`.
  A BILL is committed in month M if `dueDate <= end(M)` and it is *not paid as of end(M)* (no linked expense, or linked expense dated after end(M)). Hence an unpaid bill from an earlier month is an "extra" in every later month until paid; paying it **for its own month** (past-month view, `paidDate` in that month) removes the extra from all later months. Paid bills whose Expense is inside M are already in `spent`. Subscriptions due in M always count (they never create Expenses, AGENTS.md); unpaid subscriptions due earlier carry over identically. Result is **not clamped** (negative = over budget, red).
- **Expense↔invoice link:** nullable `Expense.invoiceId` (added in T10's migration) replaces the pay route's title-based dedupe and makes "paid as of date X" answerable.
- **Edit** = `PATCH /api/invoices/[id]` + reuse `AddInvoiceModal` in edit mode (`editingInvoice` in context), not a second form. Unpaid rows recompute `PENDING/OVERDUE` from `dueDate`. Editing a PAID one-off bill does not retro-edit the already-created Expense; amount/date fields are disabled with a hint for PAID non-subscriptions.
- **Migrations are additive only.** `prisma migrate dev` can prompt a reset on drift → forbidden by AGENTS.md §2. Use `prisma migrate diff … --script` → place migration dir manually → `prisma migrate deploy`. Back up `prisma/dev.db` first (`cp prisma/dev.db /tmp/dev.db.bak`).
- Before writing code the implementer MUST skim the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md: this is not the Next.js from training data; `params` is already a `Promise` in this repo's routes).

## Task list

Full task bodies (description, acceptance, verification, deps, files, size) are in `tasks/todo.md`. Index:

### Phase 1 — Unblockers & quick wins
- [ ] T1 Fix auth bootstrap race (no redirect on reload/direct URL)
- [ ] T2 Wallet dropdown + quick-add menu no longer clipped
- [ ] T3 Profile page (view/edit) linked from sidebar
- [ ] T4 "Add Subscription" opens modal on Subscription type

### Checkpoint 1

### Phase 2 — Month focus
- [ ] T5 Global selected month + month-scoped wallet API + dashboard switcher
- [ ] T6 Calendar and Expenses pages follow the global month
- [ ] T7 Calendar toolbar: filters + view toggle directly above calendar

### Checkpoint 2

### Phase 3 — Edit
- [ ] T8 Edit bill/subscription: API + modal edit mode + list-view entry point
- [ ] T9 Edit entry points on subscriptions section and day agenda

### Checkpoint 3

### Phase 4 — Planned expenses & projection
- [ ] T10 PlannedExpense schema, migration, API, month payload
- [ ] T11 Create + list planned expenses in UI
- [ ] T12 Realize planned expense; include in export/import
- [ ] T13 "If everything is paid" projection on dashboard
- [ ] T14 Unpaid-bills banner for the selected month (mark-as-paid, past-month aware)

### Checkpoint 4

### Phase 5 — Finish
- [ ] T15 Recurring subscription roll-forward (approved)
- [ ] T16 Full regression, both auth modes, both languages, docs

## Parallelization (only if you want it at build time)

Safe in parallel: T1 ∥ T4; T10 ∥ T6 (after T5). Must be serial: T2→T3 (same file), T4→T8→T9, T6→T7, T10→T11→T12, anything touching `AppContext.tsx` or `schema.prisma`. Whether to use subagents (and Paseo-profile vs native selection) is your call when we start building.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Root cause of #8 differs from reading (e.g. secure cookie over non-localhost http) | Med | T1 step 1 is a reproduction (normal mode, hard reload of `/wallet`, watch network + `Set-Cookie`) before any edit |
| Migration touches real `dev.db` (git-tracked, already modified) | High | Backup first; additive migration only; `migrate diff` + `migrate deploy`; never `migrate reset`; don't stage `dev.db` unintentionally |
| Existing `pnpm test` scripts write to `dev.db` | Low | They clean up after themselves; new tests are DB-free |
| Month math off-by-one (TZ, DST, month rollover Dec→Jan) | High | Pure helpers + DB-free tests incl. Dec/Jan, Feb leap, and `TZ=Europe/Athens`; T6 manual check on the 1st/last day of month |
| Out-of-order responses when clicking months fast | Med | Stale-response guard in `refreshWallet`; acceptance criterion in T5 |
| Projection double-counts paid bills or misses subscriptions | High | Formula documented above; unit tests cover paid bill / unpaid bill / paid sub / planned / overdue carry-over |
| Pay-route title dedupe under-reports spend (finding 6) | Med | Q2 |
| Sidebar edited by T2 and T3 | Low | Serial |
| `AppContext.tsx` is a hot file (T1, T4, T5, T8, T10) | Med | Serial order above; each task re-reads the file first |

## Resolved decisions

- **Q1 — yes.** Recurring roll-forward approved (T15).
- **Q2 — yes.** `Expense.invoiceId` link replaces title dedupe (schema in T10, pay-route logic in T12).
- **Q3 — revised by user:** overdue bills count as an extra in the following months; going back to the bill's own month and marking it paid removes the extra from later months. Implemented as "unpaid as of end of month" (see formula) plus `paidDate` on the pay route so the payment is attributed to the chosen month.
- **Q4 — yes + addition:** urgent banner stays today-based; sidebar "left" follows the selected month; **new** banner for the selected month listing unpaid bills/subscriptions with Mark-as-paid (T14).
- **Execution:** gemini via profile "AGY - subagent" (antigravity-cli/gemini-3.8-flash, accept-edits); same checkout, sequential; orchestrator does schema/migration work and reviews every diff.

## Remaining assumptions to flag

- **Paid subscriptions due in the month are counted; a subscription due earlier but paid inside M is attributed to its due month, not M.** Simple and predictable; say so if you want cash-basis instead.
- When marking paid from a past month, the Expense date defaults to the bill's due date (inside that month).

## Added during execution (user requests after approval)

- **Category limits are not manageable anywhere (finding):** no API or UI exists to create/edit/delete categories or their `monthlyLimit` (only register/new-wallet defaults). Added **T17** (owner-only API + tightening `PATCH /api/wallets/[id]`, which currently only blocks `VIEWER`, contradicting the AGENTS.md rule "only OWNER edits budget targets") and **T18** (Categories & Limits section on `/wallet`, "Manage limits" link on the dashboard). Deleting a category leaves expenses/bills/planned expenses uncategorised.
- **Incomplete Greek translation / hardcoded text:** added **T19** (checker script `pnpm i18n:check` using the TS compiler API + locale-aware date/relative formatting), **T20** (dashboard), **T21** (calendar/bills), **T22** (expenses, wallet, modals, auth, invites, sidebar, API error messages; checker added to `pnpm test` at zero). The sweep runs after all feature tasks so new strings are covered.
- **Execution order:** Phase 2 → 3 → T17, T18 → Phase 4 → T15 → T19–T22 → T16 (regression last).
- **Q5 (open):** activity-log `details` sentences ("X added bill …") are stored in English in the DB when written, so they cannot be translated at render time. Default: translate the action title from the `action` code and show stored details as-is. Alternative (recommended if you want zero English): change logging to store structured data (`action` + JSON params) and render localized sentences; old rows keep their English text. Say the word and I'll add it as T23.
