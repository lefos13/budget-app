# Implementation Plan: Full-fidelity wallet export/import + Alerts screen

Status: **IMPLEMENTED — approved decisions: Q1 append, Q2 include emails, Q3 sidebar badge, Q4 no dashboard summary, Q5 additive. Verified with pnpm test, lint, build.**
Previous plan (8 improvements, T1–T23) archived at `tasks/archive/2026-improvements-{plan,todo}.md`. No SPEC.md exists; the two user requests + `AGENTS.md` are the spec.

## Overview

| # | Request | Slices |
|---|---------|--------|
| 1 | Wallet export must contain all data (expenses, bills, history, …) and import must restore all of it | T1, T2 |
| 2 | "Λογαριασμοί που λήγουν σύντομα" (`UrgentRemindersBanner`) and "Ανεξόφλητα αυτού του μήνα" (`UnpaidBillsBanner`) are huge on dashboard/calendar. Move them to their own screen, opened from an alert badge | T3, T4, T5 |

## Findings from reading the code

### Export / import (`src/app/api/wallets/[id]/{export,import}/route.ts`)
Export is `version: '1.0'`. Gaps versus the schema (`prisma/schema.prisma`):

1. **Activity history is not exported at all** (`ActivityLog`: action, details, timestamp, user). Request explicitly names "history".
2. **Realized planned expenses dropped**: export filters `plannedExpenses` to `status: 'PENDING'`; `status`, `realizedExpenseId` are not exported, and import hard-codes `status: 'PENDING'`.
3. **Expense ↔ bill link lost**: `Expense.invoiceId` (added in the earlier T10) is neither exported nor imported → after import, paying an already-paid bill can create a duplicate Expense (pay route dedupes on `invoiceId`), and paid-bill expenses are unlinked.
4. **Attribution lost**: `Expense.userId`, `InvoiceBill.userId`, `InvoiceBill.paidByUserId`, `PlannedExpense.userId` all become the importing user. Timestamps `createdAt` (all models) reset to import time.
5. Import invoices: `status` is taken from file as-is (any string), `paidAt` restored, but no `paidByUserId`.
6. Import is a sequence of independent `prisma.*.create` calls with **no transaction** → a failure at row N leaves a half-imported wallet.
7. Import is **append-only with no dedupe**: importing the same file twice doubles everything (categories are deduped by name; nothing else is). See Q1.
8. Wallet route returns only `take: 10` activity logs, so export must query logs itself (all rows).
9. Old `version: '1.0'` files (and files with only some arrays) MUST keep importing.
10. Members and invites are deliberately **not** exported: invite `code`s are secrets that grant wallet access, and membership is not portable data. Documented in export `README`/plan; exported user identity is limited to name+email for attribution mapping only (see Q2).

### Alerts (`src/components/urgent-reminders-banner.tsx` 186 LOC, `unpaid-bills-banner.tsx` 272 LOC)
- Both rendered inline at the top of `src/app/page.tsx` and `src/app/calendar/page.tsx`; each grows with item count (no cap) → pushes content down.
- Urgent banner: today-based; overdue or imminent unpaid bills (`formatRelativeDueDate`). Unpaid banner: selected-month unpaid bills/subs + carry-over from earlier months, with Mark-as-paid (`paidDate` inside the viewed past month).
- Sidebar (`sidebar.tsx`, 960 LOC) already supports nav `badge` (calendar item shows `overdueCount`) and has a mobile topbar + drawer + bottom nav (`md:hidden`). Layout wrapper is `src/app/layout.tsx`.
- Both banners derive from `walletData`; count logic is duplicated inside components → extract once so badge and screen agree.
- i18n: keys `urgent.*`, `unpaidBanner.*` exist in both dictionaries; new keys needed for nav item, page title, empty state. `pnpm i18n:check` is part of `pnpm test` and must stay at 0 violations.

## Architecture Decisions

**Export format v2.0 (backward compatible).**
- Each exported record gets a file-local `ref` (its DB id) so links can be rebuilt without depending on target DB ids: `expenses[].ref`, `invoices[].ref`, `plannedExpenses[].ref`; links: `expenses[].invoiceRef`, `plannedExpenses[].realizedExpenseRef`.
- Add: `activityLogs[]` (`action, details, timestamp, userName, userEmail`), `createdAt`/`updatedAt` on records, `plannedExpenses` of all statuses with `status`, `userName/userEmail` attribution (expense, invoice, planned, `paidBy`).
- Keep existing field names untouched (additive) so v1.0 importers/readers and existing tests still work; bump `version` to `'2.0'`.
- Import accepts v1 and v2; every new field optional. Unknown/invalid new values fall back to previous defaults (e.g. status not in `PENDING|PAID|OVERDUE` → derive from due date as today).

**Attribution mapping on import:** match `userEmail` to a member of the target wallet → use that user; otherwise the importer, with original author name preserved in the activity-log detail text only (no schema change, no new users created).

**Atomicity:** import runs inside one `prisma.$transaction` (interactive, raised timeout); ref map (`Map<ref, newId>`) built in dependency order: categories → invoices → expenses (needs `invoiceRef`) → planned (needs `realizedExpenseRef`) → activity logs.

**No schema migration** is needed (all target columns exist). DB safety rule respected: no reset, no destructive migration.

**Alerts screen = a real route `/alerts`** (matches "another screen"; deep-linkable, works on mobile without a new overlay component). The two banners' *content* moves there as sections; they are removed from dashboard and calendar.

**Badge placement — sidebar, plus mobile topbar bell.** Reason: the sidebar already has badge plumbing and collapsed/expanded states; a fixed top-right floating widget would overlap page content/month switcher on desktop and the mobile topbar. Mobile gets a bell in the existing topbar (and drawer/bottom-nav entry). See Q3 if you prefer the floating variant.

**Single source of truth:** new pure `src/lib/bill-alerts.ts` (`getUrgentBills`, `getUnpaidForMonth`, `getAlertCount`) used by the badge, the page and the tests. Badge count = distinct invoice ids in (urgent ∪ selected-month unpaid ∪ carry-over). Badge colour: red if any overdue, amber otherwise; hidden at 0 (99+ cap).

## Dependency graph

```
Export v2 (T1) ─► Import v2 + roundtrip (T1) ─► Activity log + transaction + UI summary (T2)

bill-alerts lib ─► /alerts page + badge (T3) ─► remove inline banners, compact list (T4) ─► i18n/regression (T5)

(Part 1 and Part 2 are independent; Part 1 goes first because data-fidelity bugs are higher risk.)
```

## Task List

### Phase 1: Data fidelity
- [x] T1: Export v2 + import restore of expenses/bills/planned (with links, status, attribution), verified by roundtrip
- [x] T2: Activity history in export/import; transactional import; accurate import summary in UI

### Checkpoint 1: After T1–T2
- [x] `pnpm test` (incl. new roundtrip), `npx prisma validate`, lint, build pass; DB row counts of existing wallets unchanged
- [x] Manual export → import into a fresh wallet: totals, bill statuses, history identical; v1 file still imports
- [x] Review with human

### Phase 2: Alerts screen
- [x] T3: `/alerts` page with both sections + sidebar/mobile badge
- [x] T4: Remove inline banners from dashboard & calendar; compact, scroll-capped alert lists
- [x] T5: i18n parity, both auth modes, regression

### Checkpoint 2: Complete
- [x] All acceptance criteria met, `pnpm test`, lint, build pass
- [x] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Import writes duplicate data on repeated import | High | Q1 decision; at minimum make import atomic and show counts; optional dedupe by fingerprint |
| Ref remap bug leaves `invoiceId`/`realizedExpenseId` pointing wrong | High | Roundtrip test asserts links by comparing (title, amount, date) pairs, not ids |
| Large wallets: interactive transaction timeout in SQLite | Med | Use `createMany` where no id is needed back; raise `timeout`; test with ≥2k rows |
| Exporting user emails is PII in a downloadable file | Med | Only members of the wallet (already visible to the exporter); Q2 lets you drop it |
| Removing banners hides urgent bills from users who never open `/alerts` | Med | Badge on every page + red state for overdue; consider one-line dashboard link (Q4) |
| `sidebar.tsx` is 960 LOC and shared with other work | Low | Touch only the nav item array + topbar; screenshot collapsed/expanded/mobile |
| Badge count disagrees with page content | Med | Both use `bill-alerts.ts`; unit test |

## Open Questions (defaults will be used if you don't object)

- **Q1 Re-import duplicates.** Default: keep append semantics (no dedupe) but atomic; alternative: skip records whose (title, amount, date/dueDate) already exist in the target and report `skipped` counts.
- **Q2 Include member name/email in export?** Default: yes, only for attribution/history mapping; alternative: omit and attribute everything to the importer.
- **Q3 Badge location.** Default: sidebar nav item (+ mobile topbar bell). Alternative: floating fixed bell at top-right on all screens.
- **Q4 Keep a one-line summary on the dashboard?** Default: no — badge only. Alternative: a slim single-row link ("3 bills need attention →") on the dashboard.
- **Q5 Import into non-empty wallet** vs. "restore" (replace existing data). Default: import stays additive; no destructive restore mode (AGENTS.md safety).
