# Implementation Plan: Savings buckets funding future planned expenses

Status: **IMPLEMENTED (2026-09-30) — T1–T8 incl. T4b/T4c/T5b done; verified with pnpm test, pnpm test:api, lint, build and browser walkthroughs.** Q1–Q8 resolved; passed-date assumption approved (a linked expense whose date passes unedited stays linked). Intent confirmed via interview. No SPEC.md exists; the confirmed intent below + `AGENTS.md` are the spec.
Previous plan (export/import + Alerts, all tasks done) archived at `tasks/archive/2026-export-alerts-{plan,todo}.md`.

## Confirmed intent

- **Outcome:** per wallet, a Savings area = **General savings** pool + **sub-buckets**. Each sub-bucket saves toward ≥1 linked future planned expenses via a **monthly contribution** that counts in the month's budget.
- **Sub-bucket:** exists only while it has ≥1 PENDING linked planned expense. Only expenses whose `expectedDate` is in a **future month** can be linked; one bucket per expense. Target/dates derive from linked expenses (no hand-typed target).
- **Contribution:** per expense `(amount − allocated) ÷ monthsLeft`; bucket balance is allocated to the earliest expense first; bucket contribution = sum. Shown in the month projection as a committed line; recalculated after every deposit / move.
- **Deposits:** user-recorded (the contribution or any extra top-up). Count against that month's budget, are **not** `Expense` records, lower future contributions. Direct deposits into General allowed.
- **Payment:** realizing a linked planned expense draws from the bucket first; shortfall hits the current month's budget. The `Expense` is still created; only the shortfall counts in the gauge.
- **Moves / closing:** money moves General ↔ sub-bucket ↔ sub-bucket, budget-neutral. Sub-bucket money **never** returns to the monthly budget directly: releasing it always sends it to another sub-bucket or General. A bucket left with no PENDING linked expense closes; its balance goes to (a) another sub-bucket or (b) General.
- **General as extra budget:** only General money can boost a month's budget, and only when the user explicitly chooses "Use as extra budget" (amount, current/viewed month). It raises that month's available budget; it never happens automatically.
- **General manual add / remove:** besides "save from this month's budget" (a `DEPOSIT`, counts against the month), General supports manual adjustments for money coming from or going to outside the app (existing savings, bonus, gift, emergency cash-out). They change **only** General's balance: no bucket, no monthly budget, no `Expense`. Removal can't take General below €0. Shown in General's history and the activity log as manual adjustments.
- **Date edits:** editing a linked planned expense's date into the current or a past month **unlinks it** from its bucket (same lifecycle rule as a manual unlink).
- **Permissions/data:** OWNER + MEMBER act; VIEWER read-only. Every action in `ActivityLog`. Buckets and movements included in export/import (additive). en + el.
- **Out of scope:** real bank accounts/interest, automatic deposits, deeper nesting, hand-typed targets, bills/subscriptions linked to buckets, recurring planned expenses, cross-wallet goals.

## Findings from reading the code

- **No savings concept exists.** Wallet has one `monthlyBudget`; no income/balance.
- `src/app/api/wallets/[id]/route.ts`: `totalSpentMonth = Σ expense.amount` of the month; `categorySpending` from the same expenses; fetches only planned expenses **of the selected month**; builds `computeMonthProjection(...)` → `metrics.projection`.
- `src/lib/month-projection.ts` (pure, tested by `scripts/test-month-projection.ts`): `projectedRemaining = B − spent − plannedPending − billsDue − subscriptionsDue − carryOver`. Extend here, not in the route.
- `src/app/api/planned-expenses/[id]/realize/route.ts`: `$transaction` flips PENDING→REALIZED (race-safe `updateMany`), creates `Expense` with full amount, links `realizedExpenseId`, logs. This is where the bucket draw goes.
- `PATCH /api/planned-expenses/[id]` edits only PENDING; `DELETE` deletes any status. Both must respect bucket rules (date moved to current/past month → auto-unlink; last-expense closing).
- Planned expense UI: `src/app/expenses/page.tsx` (list, realize, delete), `src/components/modals/add-expense-modal.tsx` (create/edit PLANNED). Month-scoped via `selectedMonth` in `AppContext`.
- Month helpers in `src/lib/month.ts` (`getMonthBounds`, `isValidMonthKey`); TZ-sensitive tests already run under `TZ=Europe/Athens` and `UTC` (`test-bill-alerts.ts`).
- Nav: `src/components/sidebar.tsx` item array + mobile drawer/bottom nav (pattern from `/alerts`).
- Export/import v2 in `src/app/api/wallets/[id]/{export,import}/route.ts` with ref→id remap inside one transaction; `scripts/test-wallet-roundtrip.ts`.
- Migrations: `prisma/migrations/` (3 existing). Schema change **is required** this time.

## Architecture Decisions

**Data model (additive migration only — no reset, no drops):**
```prisma
model SavingsBucket {
  id        String   @id @default(cuid())
  walletId  String
  kind      String   @default("GOAL")   // GENERAL | GOAL  (exactly one GENERAL per wallet, created lazily)
  name      String
  color     String   @default("#10b981")
  icon      String   @default("PiggyBank")
  status    String   @default("ACTIVE") // ACTIVE | CLOSED
  closedAt  DateTime?
  wallet    Wallet   @relation(...onDelete: Cascade)
  plannedExpenses PlannedExpense[]
  transactions    SavingsTransaction[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SavingsTransaction {        // append-only ledger; balance = Σ amount
  id               String   @id @default(cuid())
  walletId         String
  bucketId         String
  userId           String
  type             String   // DEPOSIT | TRANSFER_IN | TRANSFER_OUT | EXPENSE_DRAW | BUDGET_BOOST | ADJUSTMENT_IN | ADJUSTMENT_OUT (last three GENERAL only)
  amount           Float    // signed: + into bucket, − out of bucket
  date             DateTime // month attribution for budget effect
  transferGroupId  String?  // pairs TRANSFER_OUT/IN
  plannedExpenseId String?
  expenseId        String?
  note             String?
  createdAt        DateTime @default(now())
  @@index([walletId, date])
  @@index([bucketId])
}

PlannedExpense.savingsBucketId String?  (onDelete: SetNull)
Expense.savingsFundedAmount    Float @default(0)
```
Rationale: a signed ledger (not a mutable `balance` column) makes balance, "deposited this month", history and export trivially consistent and race-safe inside `$transaction`. Status/kind as `String` matches existing convention (`InvoiceBill.status`, `WalletMember.role`).

**Budget effect per month M (single definition, in `month-projection.ts`):**
- `spent` = Σ `expense.amount − expense.savingsFundedAmount` (only shortfall counts).
- `deposited` = Σ ledger `DEPOSIT` dated in M (transfers, `EXPENSE_DRAW` and `ADJUSTMENT_*` are budget-neutral; adjustments never count towards a contribution either).
- `boost` = Σ |`BUDGET_BOOST`| dated in M (only from General, only by explicit user action) → effective budget `B' = B + boost`.
- `savingsDue` = max(0, contributionDue(M) − deposited) — the still-to-deposit part, a committed line like subscriptions.
- Gauge: used = `spent + deposited` against `B'` (boost shown as "+€X extra from General"). `projectedRemaining = B' − spent − deposited − savingsDue − plannedPending' − billsDue − subscriptionsDue − carryOver`, where `plannedPending'` for a linked expense due in M counts only its unfunded part.

**Contribution math (new pure `src/lib/savings.ts`, DB-free, fully unit-tested):**
- `monthsLeft(M, E) = monthIndex(E) − monthIndex(M)` — contributions happen in months M…E−1; the due month itself gets none (it's covered by the draw + shortfall). If `monthsLeft ≤ 0` (due month or overdue, not realized) the whole unfunded remainder is due in M.
- Contribution for month M is computed from the **balance at the start of M** (ledger before M), so it's stable during the month; deposits in M reduce `savingsDue` and extra above it lowers M+1 onward. Skipped months → next months auto-catch-up.
- Allocation: pending linked expenses sorted by `expectedDate` asc (tie: `createdAt`), balance fills each in order.
- All amounts `round2`; contribution rounded **up** to the cent so the goal is never missed by rounding.
- Future-month views show the projected contribution assuming scheduled deposits are made.

**Closing / disposition:** any operation that removes the last PENDING linked expense of a bucket with balance > 0 (realize with leftover, delete, unlink, date edited into current/past month, re-link elsewhere) requires `disposition: { type: 'BUCKET' | 'GENERAL', targetBucketId? }` in the request. Missing → `409 { error: 'Disposition required', leftover }`; UI shows a modal and retries. Zero balance → closes silently. All inside the same `$transaction`.

**Payment:** realize route, in its existing transaction: `draw = min(balance, finalAmount)`; ledger `EXPENSE_DRAW −draw`; `Expense.savingsFundedAmount = draw`; unlink stays for history (`savingsBucketId` kept, status REALIZED). Other buckets' allocations recompute naturally.

**UI:** new route `/savings` (sidebar + mobile nav, `PiggyBank` icon): General card + sub-bucket cards (saved / target, progress, "due this month", next due date, linked expenses, actions Deposit / Move / Withdraw). Link entry point lives on the planned expense (row action on `/expenses` + field in the planned modal): "Save for this" → pick existing bucket or create new (name defaults to expense title). Bucket creation is **only** possible from a planned expense → invariant enforced by API, not just UI.

**API surface (Route Handlers — read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `03-api-reference/03-file-conventions/route.md` first):**
- `GET  /api/wallets/[id]/savings?month=YYYY-MM` → General + active buckets with balance, allocations, contributionDue, depositedThisMonth; closed buckets summary.
- `POST /api/planned-expenses/[id]/savings` `{ bucketId } | { newBucket: { name, color?, icon? } }` → link (creates bucket atomically). `DELETE` same path → unlink (+ disposition rule).
- `POST /api/savings/[bucketId]/deposit` `{ amount, date? }` (bucket or General).
- `POST /api/savings/[bucketId]/transfer` `{ toBucketId, amount }` — the only way money leaves a sub-bucket besides paying its expense (to another sub-bucket or General).
- `POST /api/savings/[bucketId]/boost` `{ amount, date? }` — GENERAL only (400 otherwise): ledger `BUDGET_BOOST −amount`, raises that month's budget.
- `POST /api/savings/[bucketId]/adjust` `{ direction: 'IN' | 'OUT', amount, note? }` — GENERAL only (400 otherwise): ledger `ADJUSTMENT_IN +amount` / `ADJUSTMENT_OUT −amount`; OUT > balance → 400; budget-neutral.
- Existing realize / PATCH / DELETE planned routes accept `disposition` where needed; PATCH auto-unlinks when the new date is not in a future month.

## Dependency graph

```
savings.ts (pure math, T1)
   │
   ├─► schema + migration + link/unlink/list API (T2) ─► /savings page + "Save for this" UI (T3)
   │                                                        │
   │                          ┌─────────────────────────────┘
   ├─► deposits + projection/gauge integration (T4) ─────────┤
   │                                                        │
   └─► pay from savings: realize draw + shortfall (T5) ─────┤
                                                            │
        move, General boost, close-with-disposition (T6) ◄─┘
                         │
        export/import of savings (T7) ─► i18n, auth modes, docs, regression (T8)
```
T1 first (highest-risk logic, no DB). T2 is the only migration; everything after is sequential on it. T4/T5 both touch `month-projection.ts` + wallet route → sequential, not parallel.

## Task List

### Phase 1: Foundation
- [x] T1: Pure contribution/allocation math (`src/lib/savings.ts`) + DB-free tests
- [x] T2: Schema migration + link/unlink/create-from-planned + list API (+ API test script)
- [x] T3: `/savings` page (read view) + "Save for this" on planned expenses + nav

### Checkpoint 1: After T1–T3
- [x] `pnpm test`, `npx prisma validate`, lint, build pass; `dev.db` row counts of existing tables unchanged
- [x] A future planned expense can be put in a new/existing bucket; `/savings` shows target and correct monthly contribution; current-month expense cannot be linked
- [x] Review with human

### Phase 2: Money flows
- [x] T4: Deposits (bucket + General) and budget integration (projection line, gauge, recalculation)
- [x] T4b: General manual add / remove (budget-neutral adjustments)
- [x] T4c: Editable bucket names (rename existing sub-buckets; name editable in every create path)
- [x] T5: Paying a linked expense from savings (draw + shortfall, `savingsFundedAmount`)
- [x] T5b: Monthly contributions shown as monthly items with a Save action on `/expenses` and Overview (user-reported gap)
- [x] T6: Move money, General "use as extra budget", and close-with-disposition (other bucket / General) everywhere the last expense can leave a bucket

### Checkpoint 2: After T4–T6
- [x] Full lifecycle end-to-end: link → deposit → extra top-up lowers contribution → pay with shortfall → leftover → disposition
- [x] Ledger invariant script: Σ balances == Σ deposits − releases − draws; no negative balances (`test-savings-api.ts` test 19, 200 random ops)
- [x] Review with human (user asked to continue through all tasks)

### Phase 3: Data + polish
- [x] T7: Export/import of buckets, ledger, links (roundtrip)
- [x] T8: i18n parity, both auth modes, VIEWER, docs (AGENTS.md domain rules, README), regression

### Checkpoint 3: Complete
- [x] All acceptance criteria met; `pnpm test`, `pnpm test:api`, lint, build pass
- [x] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration damages `dev.db` | High | Copy `prisma/dev.db` → `prisma/dev.db.bak-<date>` before applying; additive only (`migrate dev --create-only`, review SQL, then apply); no reset (AGENTS.md §2) |
| Double counting (deposits + full expense in gauge) | High | Single definition in `month-projection.ts`; tests for a full lifecycle month-by-month summing to the expense amount exactly once |
| Rounding leaves goal €0.01 short / contribution drift | Med | Round contribution up to cents; test that N scheduled deposits ≥ target |
| Month-boundary / TZ bugs in `monthsLeft` and ledger attribution | Med | Reuse `src/lib/month.ts`; run T1 tests under `TZ=Europe/Athens` and `TZ=UTC` |
| Concurrent deposit/transfer/boost → negative balance | Med | Balance checked inside `$transaction` from ledger sum; reject if insufficient |
| Invariant "bucket needs ≥1 pending expense" bypassed via PATCH (date moved to current/past → auto-unlink), DELETE, import | Med | Central helper `assertBucketLifecycle(tx, bucketId, disposition?)` called by every mutating route; import creates buckets only with linked expenses |
| `wallets/[id]` route grows heavier (all pending linked expenses + ledger) | Low | Aggregate ledger with `groupBy`; savings detail lives in separate `/savings` endpoint |
| AGENTS.md "Expense counts against gauge" rule changes meaning | Low | Update AGENTS.md §4 in T8 with the savings-funded rule |

## Resolved decisions (human, 2026-09-30)

- **Q1 Category totals for a savings-funded expense:** category breakdown and category limits use the **net** (budget) portion, consistent with the gauge; the expense row shows a "€X from savings" badge.
- **Q2 Contribution months:** months M…E−1; the due month gets no contribution.
- **Q3 Deposit date:** today when viewing the current month; within the viewed month when viewing a past month (same as bill Mark-as-paid). No future-dated deposits.
- **Q4 Date edited into current/past month:** not allowed to stay linked — the expense is **unlinked** from its bucket (last-expense → disposition). A linked expense whose date simply *passes* without edit stays linked; its remainder is due now.
- **Q5 Releasing bucket money:** always to General (or another sub-bucket), never straight into the monthly budget. General money boosts a month's budget only via explicit "Use as extra budget".
- **Q6 Closed buckets:** kept (status CLOSED) with their history, shown collapsed under "Completed" on `/savings`; not deletable.
- **Q7 General manual add / remove (added 2026-09-30):** keep both: "Save from this month's budget" (`DEPOSIT`, counts) and manual add/remove (`ADJUSTMENT_IN/OUT`, budget-neutral, General only, never below €0).
- **Q8 Editable bucket names (added 2026-09-30):** every sub-bucket name is editable after creation and at creation in every entry point (including the planned-expense modal, which previously used the expense title verbatim). General keeps its fixed, translated label.
