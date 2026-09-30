# Task List — Savings buckets funding future planned expenses

Plan, confirmed intent and rationale: `tasks/plan.md`. Status: **APPROVED (2026-09-30) — in progress.** Old plan: `tasks/archive/`.

Standard verification (AGENTS.md §7), referred to as **STD**:
- `npx prisma validate`
- `npx tsx scripts/test-e2e.ts` (and `pnpm test` for the full set; `pnpm test:api` for API scripts)
- `pnpm run lint`
- `pnpm run build`
- Manual: `pnpm dev`, drive the UI in the browser; check both `authMode` values and both languages for any UI change.

Every task: read the relevant `node_modules/next/dist/docs/` guide first (AGENTS.md); new UI text via `useTranslation()` keys in **both** `en.ts` and `el.ts`; never reset/wipe the DB; API tests use throwaway wallets deleted afterwards.

---

## Phase 1 — Foundation

### T1: Pure contribution / allocation math
**Description:** New DB-free `src/lib/savings.ts`: `bucketBalance(ledger, beforeDate?)`, `allocate(balance, pendingExpenses)` (earliest `expectedDate` first, tie `createdAt`), `monthsLeft(monthKey, expectedDate)`, `contributionDue(monthKey, bucket)` (from balance at start of month; `monthsLeft ≤ 0` → full remainder; rounded up to cents), `depositedInMonth`, `savingsDue = max(0, due − deposited)`, `canLinkToSavings(expectedDate, today)` (future month only). Reuse `src/lib/month.ts`. Add `scripts/test-savings.ts` to `pnpm test`.
**Acceptance criteria:**
- [x] €3,000 in 6 months + €9,000 in 24 months, balance 0 → due €500 + €375 = €875; after one extra €1,000 deposit, next month's due drops accordingly; skipped month → next month catches up.
- [x] Following the schedule month by month funds every expense in full by its own due month (never short by rounding).
- [x] Due month / overdue → no further contribution (remainder shows as the expense's unfunded part via `fundedByPlannedId`); current-month and past expenses are not linkable.
**Verification:**
- [x] `TZ=Europe/Athens npx tsx scripts/test-savings.ts` and `TZ=UTC …` both pass (month boundaries, Dec→Jan, leap Feb); also passes under `America/Los_Angeles`.
- [x] `pnpm test`, lint.
**Implementation note:** deposits **and transfers** (e.g. from General) dated in the month count towards that month's contribution (`contributedInMonth`); only `DEPOSIT` has a budget effect (`depositedInMonth`). Future months are simulated assuming scheduled deposits are made.
**Dependencies:** None
**Files likely touched:** `src/lib/savings.ts` (new), `scripts/test-savings.ts` (new), `package.json`
**Estimated scope:** Small–Medium (3 files)

### T2: Schema + link / unlink / create-from-planned + list API
**Description:** Back up `prisma/dev.db`. Add `SavingsBucket`, `SavingsTransaction`, `PlannedExpense.savingsBucketId`, `Expense.savingsFundedAmount` (see plan) via `prisma migrate dev --create-only` → review SQL (only CREATE TABLE / ADD COLUMN / CREATE INDEX) → apply. Routes: `POST/DELETE /api/planned-expenses/[id]/savings` (link to existing bucket or create a new one atomically; unlink), `GET /api/wallets/[id]/savings?month=` (General lazily created, active buckets with balance, allocations, contributionDue, next due date; closed list). Central `src/lib/savings-server.ts` helper `assertBucketLifecycle(tx, bucketId, disposition?)` — for now: unlinking the last expense of a zero-balance bucket closes it; non-zero → 409 `Disposition required` (disposition execution arrives in T6). Activity logs `SAVINGS_BUCKET_CREATED`, `PLANNED_EXPENSE_LINKED/UNLINKED`. VIEWER 403, non-member 403, unauth 401.
**Acceptance criteria:**
- [x] Linking a future-month PENDING expense to a new bucket creates the bucket + link in one transaction; linking a current/past-month or REALIZED expense → 400; linking to another wallet's bucket → 400.
- [x] A bucket can't be created without a planned expense (no standalone create endpoint); GENERAL can't be a link target.
- [x] `GET …/savings` returns correct target, balance 0, contributionDue per T1 math; existing tables' row counts unchanged by the migration.
**Verification:**
- [x] `npx tsx scripts/test-savings-api.ts` (new, in `test:api`) covering the above + permissions.
- [x] STD.
**Implementation notes:** migration `20260930110306_add_savings_buckets` was hand-edited to `ALTER TABLE … ADD COLUMN` (Prisma generated a copy-and-drop rebuild); dry-run on a copy showed identical row counts and a clean FK check; `prisma migrate diff` reports no drift. Backup: `prisma/dev.db.bak-2026-09-30-savings`. Helper is `closeBucketIfEmpty(tx, bucketId, user, disposition?)` in `src/lib/savings-server.ts`, and it already **executes** dispositions (GENERAL / other BUCKET) and is wired into link/re-link, unlink, planned PATCH (auto-unlink when the date leaves the future months), planned DELETE and realize — pulled forward from T6 so the "≥1 pending expense" invariant holds from day one. T6 keeps the UI modal + transfer/boost endpoints.
**Dependencies:** T1
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_savings/migration.sql`, `src/lib/savings-server.ts` (new), `src/app/api/planned-expenses/[id]/savings/route.ts` (new), `src/app/api/wallets/[id]/savings/route.ts` (new), `scripts/test-savings-api.ts` (new), `package.json`
**Estimated scope:** Medium–Large (migration is mechanical; routes share one helper)

### T3: `/savings` page (read view) + "Save for this" + nav
**Description:** `src/app/savings/page.tsx`: General card + sub-bucket cards (name, saved / target, progress bar, "Due this month", next due date, linked expenses), closed buckets collapsed under "Completed", empty state explaining buckets start from a planned expense. Sidebar + mobile drawer/bottom nav item (`PiggyBank`), collapsed/expanded correct. On `/expenses` planned rows (future month only) and in the planned-expense modal: "Save for this" → choose existing bucket or create new (name defaults to expense title); linked rows show a bucket chip + "Unlink". `AppContext` types for savings data + `refreshSavings`.
**Acceptance criteria:**
- [x] From `/expenses`, link a planned expense 5 months ahead to a new bucket → `/savings` shows it with the correct monthly contribution; link a second expense to the same bucket → target and contribution update. (Browser: €3,000 Mar 2027 via modal "New bucket", €9,000 Sep 2028 via row "Save for this" → €500 + €375 = €875.)
- [x] "Save for this" is hidden/disabled for current-month and realized expenses and for VIEWER. (Row + modal gated on `canLinkToSavings` / role; API 403 for VIEWER verified; no VIEWER exists in `dev.db`, so the VIEWER UI was not clicked through.)
- [x] Works at 375px and in both languages (screenshots). Dark mode uses the same `dark:` classes as existing cards; not screenshotted.
**Verification:**
- [x] STD; browser: `/savings` empty, with a bucket, after unlink → closed under "Completed"; `/expenses` link flow (row + modal); sidebar collapsed; mobile 375px (bottom nav adjusted to fit 6 items).
**Dependencies:** T2
**Files likely touched:** `src/app/savings/page.tsx` (new), `src/components/savings/*` (new, bucket card + link modal), `src/app/expenses/page.tsx`, `src/components/modals/add-expense-modal.tsx`, `src/components/sidebar.tsx`, `src/context/AppContext.tsx`, dictionaries
**Estimated scope:** Medium–Large — split into T3a (page + nav) / T3b (link UI) if it grows

### Checkpoint 1: After T1–T3
- [x] `pnpm test`, `pnpm test:api`, `npx prisma validate`, lint, build pass
- [x] `dev.db` backup exists; pre-existing row counts unchanged (browser QA rows removed; empty lazily-created General buckets remain by design)
- [x] Link flow works end-to-end in mock and normal mode — mock in browser (T3); normal mode driven with a real session cookie in T8 (create → link → deposit 201, no cookie 401)
- [x] Review with human before proceeding (approved 2026-09-30: "continue with t4")

---

## Phase 2 — Money flows

### T4: Deposits and budget integration
**Description:** `POST /api/savings/[bucketId]/deposit { amount, date? }` (sub-bucket or General; date rules per plan Q3) → ledger `DEPOSIT`, activity log. Extend `computeMonthProjection` with `deposited` and `savingsDue` (and a `boost` input, 0 until T6); wallet route feeds ledger aggregates for the month + pending linked expenses (all months) and adds `metrics.savings { deposited, savingsDue, boost }`. Gauge (`budget-overview-card.tsx`) shows used = spent + deposited with a distinct savings segment; `month-projection-card.tsx` gets a "Savings contributions" line. `/savings` cards get "Deposit" (prefilled with due amount) and General "Add money".
**Acceptance criteria:**
- [x] Depositing the due amount: bucket balance +X, month "used" +X, "Savings contributions" committed line → 0, `Expense` table unchanged. (API: TV €1,200 / 6 → due €200; after deposit `savings.deposited` 200, due 0, `remainingBudget` −200, projection unchanged, no Expense rows. Browser: dashboard "€711.68 spent of €2,800 · incl. €200.00 saved", split bar, sidebar "€2,088.32 left".)
- [x] Extra top-up above due: next month's contribution is lower by the T1 math; current month's due line stays at 0. (Extra €300 → next month €140 = (1,200 − 500) / 5.)
- [x] Amount ≤ 0 / NaN → 400; VIEWER 403; deposit into a CLOSED bucket → 409. Also: future/impossible date → 400, outsider 403, unknown bucket 404; past-month date attributed to that month.
**Verification:**
- [x] Extend `scripts/test-month-projection.ts` (test 12: deposited/savingsDue/boost/funded planned) and `scripts/test-savings-api.ts` (test 13).
- [x] STD; browser: deposit from `/savings` (prefilled €200), card due → €0, dashboard gauge + projection lines updated.
**Implementation notes:** `computeMonthProjection` gained `savings { deposited, savingsDue, boost }` input and `savingsDeposited / savingsDue / boost` outputs; `projectedRemaining = B + boost − spent − savingsDeposited − committedTotal` with `savingsDue` inside `committedTotal`. Planned inputs carry `fundedAmount` (from `computeSavingsMonth().fundedByPlannedId`), so a linked expense due this month already commits only its unfunded part (pulled forward from T5). Shared route helpers `loadBucketForWrite`, `parseAmount`, `parseMovementDate` live in `src/lib/savings-server.ts` for T4b/T6. Deposits are blocked in the UI when viewing a future month.
**Dependencies:** T3
**Files likely touched:** `src/app/api/savings/[bucketId]/deposit/route.ts` (new), `src/lib/month-projection.ts`, `src/app/api/wallets/[id]/route.ts`, `src/components/budget-overview-card.tsx`, `src/components/month-projection-card.tsx`, `src/app/savings/page.tsx`, dictionaries
**Estimated scope:** Medium (5 files + tests)

### T4b: General manual add / remove (budget-neutral)
**Description:** `POST /api/savings/[bucketId]/adjust { direction: 'IN' | 'OUT', amount, note? }` — GENERAL only (400 for sub-buckets); ledger `ADJUSTMENT_IN +amount` / `ADJUSTMENT_OUT −amount`, balance checked inside the transaction (OUT > balance → 400), activity log `SAVINGS_GENERAL_ADJUSTED`. Add both types to `SAVINGS_TX_TYPES` in `src/lib/savings.ts` (excluded from `depositedInMonth` and `contributedInMonth`). General card on `/savings` gets "Add money" / "Remove money" (manual, with optional note) next to "Save from this month's budget" from T4, with wording that makes the difference explicit (en + el). VIEWER sees no controls.
**Acceptance criteria:**
- [x] Manual add €500 → General +€500; month gauge, projection, `spent`, every sub-bucket balance and contribution unchanged; no `Expense` row. (API snapshot before/after deep-equal; browser: Household `remainingBudget` 2288.32 and projection 962.62 identical before/after.)
- [x] Manual remove €200 → General −€200, same invariants; removing more than the balance → 400 and nothing written; sub-bucket id → 400; VIEWER 403. Also: bad direction, zero amount, note > 200 chars → 400; UI disables "Remove money" at €0 and the submit button above the balance.
- [x] "Save from this month's budget" still counts against the month (T4 behaviour unchanged; T4 API tests still pass).
**Verification:**
- [x] Extend `scripts/test-savings.ts` (test 10) and `scripts/test-savings-api.ts` (test 15).
- [x] STD; browser: add €500 + remove €200 on General → €300, budget metrics unchanged. QA rows removed afterwards (a real user adjustment already in `dev.db` was left untouched).
**Implementation notes:** manual adjustments are always dated now (independent of the viewed month) since they have no budget effect. New component `src/components/savings/adjust-general-modal.tsx`.
**Dependencies:** T4
**Files likely touched:** `src/app/api/savings/[bucketId]/adjust/route.ts` (new), `src/lib/savings.ts`, `src/app/savings/page.tsx`, dictionaries, tests
**Estimated scope:** Small–Medium

### T4c: Editable bucket names
**Description:** `PATCH /api/savings/[bucketId] { name }` — sub-buckets only (GENERAL keeps its translated label → 400), ACTIVE or CLOSED, trimmed 1–60 chars, OWNER/MEMBER only, activity log `SAVINGS_BUCKET_RENAMED` (old → new). `/savings` bucket card: pencil button → inline rename (Enter saves, Esc cancels). Creation: the "Save for this" modal already has a name field; the planned-expense modal's "New bucket" option gets an editable name input (prefilled with the expense title) instead of using the title verbatim. en + el.
**Acceptance criteria:**
- [x] Renaming a bucket updates `/savings`, the "Saving in …" chip on `/expenses` and the Save-for-this bucket list; balance/links untouched. (API: renamed name in `plannedExpenses[].savingsBucket`, balance €510 unchanged; browser: inline rename → "QA Road bike".)
- [x] Blank / > 60 chars → 400; GENERAL → 400; VIEWER 403; other wallet's member 403. Also: missing name → 400; closed buckets can be renamed.
- [x] Creating a bucket from the planned-expense modal uses the typed name, not the title. (Browser: title "QA Bike", bucket created as "QA Bicycle fund".)
**Verification:**
- [x] Extend `scripts/test-savings-api.ts` (test 17); STD; browser rename + create-with-custom-name. QA rows removed afterwards.
**Implementation notes:** the planned-expense modal's "New bucket" option now shows a "New bucket name" input prefilled with the title (follows the title until edited). The Save-for-this modal already had a name field. Rename is inline on the card (pencil → input, Enter/✓ saves, Esc/✕ cancels).
**Dependencies:** T3
**Files likely touched:** `src/app/api/savings/[bucketId]/route.ts` (new), `src/components/savings/bucket-card.tsx`, `src/app/savings/page.tsx`, `src/components/modals/add-expense-modal.tsx`, dictionaries, tests
**Estimated scope:** Small

### T5b: Monthly savings contributions as monthly items (gap found by user, 2026-09-30)
**Description:** The contribution due was only visible as a "Save €X" button on `/savings` and one projection line; users expect it where monthly items live. New shared `src/components/savings/monthly-savings-card.tsx` ("Savings this month"): one row per active bucket with a contribution or deposit this month — bucket name, monthly amount, status (**Due €X** with a "Save" button opening the existing `DepositModal`, or **Saved €X ✓** once covered), plus the total due. Rendered on `/expenses` (above Planned / Upcoming) and on the Overview dashboard. Future months show the planned amounts without a button; hidden when there are no buckets. VIEWER sees status without buttons. Deposits stay non-`Expense` records (decision unchanged).
**Acceptance criteria:**
- [x] With a bucket due €53.34 the card appears on `/expenses` and Overview showing "Due €53.34" and a Save button; saving it flips the row to "Saved €53.34 ✓" and updates the dashboard gauge/projection without reload.
- [x] Partial deposit (€20) shows "Due €33.34"; extra top-up shows "Saved" with the deposited amount. (Browser: €20 → "Due €33.34", modal re-prefilled €33.34 → "Saved €53.34", header "All contributions for this month are saved.")
- [x] No buckets → card hidden; future month → no Save button; VIEWER → no Save button. (Hidden verified after QA cleanup; future/VIEWER gated by the same checks as `/savings`.)
**Verification:** STD; browser on Overview and `/expenses`, en + el, 375px. QA rows removed afterwards.
**Dependencies:** T4
**Files likely touched:** `src/components/savings/monthly-savings-card.tsx` (new), `src/app/expenses/page.tsx`, `src/app/page.tsx`, dictionaries
**Estimated scope:** Small–Medium
**Follow-up (user report, 2026-09-30 — "where is the save button?"):** the user was viewing October while today is 30 September; deposits into future months are blocked by design (Q3), but the UI only said so in one grey line on `/savings`. Fixes: (1) in a future month the card shows **"Planned €X"** instead of "Due €X", plus a notice "Saving for it opens on {1st of the month}; until then these amounts are a forecast" and a **Go to this month** button — on Overview, Expenses and `/savings`; (2) the per-expense "saved" figure on `/savings` showed a *simulated* amount in future months (€53.34 / €160 with €0 in the bucket) — it now always shows real money. Verified in the browser (October: Planned + notice, no Save; "Go to this month" → September: Due €53.34 + Save; October expense row €0.00 / €160.00); suites green.

### T5: Pay a linked expense from savings
**Description:** In the realize route's existing `$transaction`: if the planned expense has `savingsBucketId`, `draw = min(balance, finalAmount)` → ledger `EXPENSE_DRAW −draw` (with `plannedExpenseId`, `expenseId`), `Expense.savingsFundedAmount = draw`. Wallet route: `spent` and category totals use `amount − savingsFundedAmount` (plan Q1); `plannedPending` for a linked expense due this month counts only its unfunded part. Expense rows show "€X from savings" badge. If this was the bucket's last pending expense: zero leftover → close; leftover → 409 `Disposition required` (executed in T6). Realize modal shows "€X from savings, €Y from this month's budget" before confirming.
**Acceptance criteria:**
- [x] Bucket €10,000, expense realized at €12,000 → draw €10,000, gauge +€2,000, category +€2,000 (Q1 default), bucket balance 0 and closed. (Tested at €1,000 / €1,200: draw €1,000, spent +€200, category +€200, bucket CLOSED, one `EXPENSE_DRAW` linked to the Expense.)
- [x] Realized at €9,000 with bucket €10,000 and another pending expense → draw €9,000, gauge +€0, €1,000 stays and is allocated to the other expense. (Tested at €850 / €1,000: €150 stays, allocated to the hotel expense.)
- [x] Concurrent double-realize still → one Expense, one draw (existing 409 path). (Two parallel requests → 200 + 409, one draw.)
**Verification:**
- [x] Extend `scripts/test-savings-api.ts` (test 16) and `scripts/test-savings.ts` (test 11); lifecycle: month deposit + shortfall = expense amount exactly once (projection delta −€200 after a €1,000 deposit on a €1,200 expense). `test-planned-expenses.ts` unchanged and passing (unlinked realize behaves as before).
- [x] STD; browser: linked "QA Sofa" €600 with €400 saved → confirm panel "Pays €400.00 from savings and €200.00 from this month's budget" → expense row "−€600.00 · €400.00 from savings", month total €711.68 (net).
**Bugs found and fixed during browser check:** (1) once a bucket closed, its deposits disappeared from that month's budget, because the wallet route loaded only active buckets → `loadSavingsInputs` now loads every bucket; the `/savings` list skips closed ones itself. (2) closed buckets' transfer-outs showed as "still due" → a bucket with no pending expense has nothing due. Both covered by new tests.
**Implementation notes:** the expenses page "Total Spending" also uses the net amount; the calendar day totals still show the full amount paid (informational, not a budget figure). A linked expense's "Mark as spent" opens an inline confirm with the split; unlinked expenses keep the one-click flow. A 409 `Disposition required` on realize shows a toast until T6 adds the modal.
**Dependencies:** T4
**Files likely touched:** `src/app/api/planned-expenses/[id]/realize/route.ts`, `src/app/api/wallets/[id]/route.ts`, `src/lib/month-projection.ts`, `src/app/expenses/page.tsx`, `src/components/recent-expenses-card.tsx`
**Estimated scope:** Medium (5 files)

### T6: Move money, General "use as extra budget", close-with-disposition
**Description:** `POST /api/savings/[bucketId]/transfer { toBucketId, amount }` (paired `TRANSFER_OUT/IN` via `transferGroupId`, budget-neutral) — the only way money leaves a sub-bucket besides paying its expense; there is **no** sub-bucket → budget path. `POST /api/savings/[bucketId]/boost { amount, date? }` — GENERAL only (400 otherwise) → ledger `BUDGET_BOOST`, raises that month's effective budget `B'` (projection `boost` input). Complete `assertBucketLifecycle` so every route that can remove a bucket's last PENDING expense (realize, DELETE planned, unlink, re-link, **PATCH moving the date into the current/past month → auto-unlink**) executes the disposition atomically and closes the bucket. Shared UI `DispositionModal` (a other sub-bucket / b General) triggered on 409 and by "Move" on bucket cards; General card gets "Use as extra budget" (with confirm). Planned-expense edit modal warns before saving a date that will unlink. Insufficient balance → 400; never negative.
**Acceptance criteria:**
- [x] Each disposition (other bucket / General) from each trigger (realize leftover, delete, unlink, date edit into current/past month) moves the exact amount; bucket CLOSED only when no pending expenses remain. PATCH to a future-month date keeps the link. (API tests 7, 8, 10, 11; browser: realize with €50 leftover → modal → General +€50, bucket CLOSED.)
- [x] Transfers don't change any month's gauge; no API path moves sub-bucket money to the budget; General boost raises only the chosen month's `B'` and only via the explicit action; boost > General balance → 400. (Test 18; browser: boost €50 → target €2,850, projection +€50.)
- [x] Ledger invariant holds after a randomized sequence of 200 operations (no negative balance, Σ consistent); resulting contributions recalculated on `/savings`. (Test 19: seeded PRNG, 171/200 accepted, balances == ledger sums, every transfer pair nets €0.)
**Verification:**
- [x] `scripts/test-savings-api.ts` tests 18–19 (+ existing lifecycle tests); `scripts/test-month-projection.ts` test 12 covers boost.
- [x] STD; browser: disposition from realize (other triggers share the same `useDisposition` hook and are API-tested), date-edit warning shows only for current/past-month dates, "Use as extra budget" updates gauge + projection.
**Implementation notes:** `useDisposition(buckets)` in `src/components/savings/disposition-modal.tsx` turns any `409 Disposition required` into the modal and retries the same request with the choice; wired into mark-as-spent and delete on `/expenses`, unlink on `/savings`, and PATCH in the planned-expense edit modal. `MoveMoneyModal` handles both "Move money" (bucket/General → General/other bucket) and "Use as extra budget" (General → month). Most closing logic already existed since T2.
**Dependencies:** T5
**Files likely touched:** `src/lib/savings-server.ts`, `src/app/api/savings/[bucketId]/transfer/route.ts` (new), `src/app/api/savings/[bucketId]/boost/route.ts` (new), `src/app/api/planned-expenses/[id]/route.ts`, `src/components/savings/disposition-modal.tsx` (new), `src/app/savings/page.tsx`, `src/components/modals/add-expense-modal.tsx`
**Estimated scope:** Medium–Large — split transfer + boost (T6a) from lifecycle closing + auto-unlink (T6b) if needed

### Checkpoint 2: After T4–T6
- [x] `pnpm test`, `pnpm test:api`, lint, build pass
- [x] Manual full lifecycle (API + browser): link €300 (due €150) → deposit €150 (projection unchanged) → extra €200 (Oct contribution → €0) → General manual add €100 (budget unchanged) → mark spent (€300 from savings, €0 from budget; spending unchanged) → €50 leftover → disposition to General → "Use as extra budget" €50 (target €2,800 → €2,850). Shortfall path verified in T5 (€400 saved of €600 → €200 counted). QA rows removed.
- [x] Review with human — user asked to continue through all tasks; summary given at the end.

---

## Phase 3 — Data and polish

### T7: Export / import of savings
**Description:** Export `version: '2.1'` (additive): `savingsBuckets[]` (`ref, kind, name, color, icon, status, closedAt, createdAt`), `savingsTransactions[]` (`ref, bucketRef, type, amount, date, transferGroupId, plannedExpenseRef, expenseRef, note, userName/userEmail`), `plannedExpenses[].savingsBucketRef`, `expenses[].savingsFundedAmount`. Import in the existing transaction, order: categories → invoices → expenses → buckets → planned → ledger → logs; merge imported GENERAL into the target's GENERAL; skip a GOAL bucket that would end up ACTIVE without a pending linked expense (its balance → General). v1.0/v2.0 files import unchanged.
**Acceptance criteria:**
- [x] Roundtrip of a wallet with General, 2 active buckets, 1 closed, deposits/transfers/draws yields identical balances, contributions and gauge numbers. (`test-wallet-roundtrip.ts` Test 8: General + active + closed bucket, DEPOSIT/ADJUSTMENT_IN/BUDGET_BOOST/TRANSFER pair/EXPENSE_DRAW, funded expense → balances, statuses, links, `deposited`/`boost`/`savingsDue`, `savingsFundedAmount` deep-equal; transfer group ids regenerated.)
- [x] v2.0 file still imports (200, sensible counts); malformed savings rows skipped, not 500. (Tests 2–4 unchanged and passing; unknown type / unknown bucket rows skipped; an inconsistent ledger → 400 with full rollback, not 500.)
- [x] Import summary UI lists savings buckets and movements (en + el). ("Savings buckets" tile in preview and result; DATA_IMPORTED log includes bucket + movement counts.)
**Verification:**
- [x] Extend `scripts/test-wallet-roundtrip.ts`; STD; manual export (Personal Wallet) → import via Wallet page into a throwaway wallet: General €200, bucket target €160, €53.34/month, linked expense — identical to source. Throwaway wallet removed.
**Implementation notes:** an ACTIVE bucket arriving without a pending linked expense is closed and its money moved to General (Test 8). Ledger signs are normalised by type on import. Export version asserted as `2.1` (additive).
**Dependencies:** T6
**Files likely touched:** `src/app/api/wallets/[id]/export/route.ts`, `src/app/api/wallets/[id]/import/route.ts`, `src/components/modals/import-wallet-modal.tsx`, `scripts/test-wallet-roundtrip.ts`, dictionaries
**Estimated scope:** Medium (5 files)

### T8: i18n parity, auth modes, docs, regression
**Description:** All new strings in en + el (nav, page, cards, modals, errors via `src/lib/i18n/api-errors.ts`, aria-labels); `pnpm i18n:check` = 0. Walk mock + normal mode, OWNER/MEMBER/VIEWER, desktop + mobile. Update AGENTS.md §4 (savings domain rules, savings-funded expenses count only shortfall) and README (feature + export 2.1). Remove throwaway data/scripts.
**Acceptance criteria:**
- [x] `pnpm i18n:check` = 0 violations; en/el key parity.
- [x] VIEWER sees `/savings` read-only (no Deposit/Move/Use-as-extra-budget/Link controls; API 403). (Browser as a throwaway VIEWER: only month-switcher buttons + read-only hint; "Savings this month" card on Overview/Expenses without buttons; deposit API 403.)
- [x] No console errors on `/`, `/expenses`, `/savings`, `/calendar`, `/alerts`, `/wallet`. (Walked as VIEWER; every API call 200.)
**Verification:** `pnpm test`, `pnpm test:api`, `npx prisma validate`, `prisma migrate diff` (no drift), lint, build. Normal auth mode: registered a throwaway user and drove create wallet → planned → link → deposit with the session cookie only (201), same call without cookie → 401. Docs: README (savings, projection formula, export 2.1, roles) and AGENTS.md §4 (savings domain rules). Throwaway users/wallets/files removed; `dev.db` back to 5 users / 3 wallets.
**Dependencies:** T1–T7
**Estimated scope:** Small

### Checkpoint 3: Complete
- [x] All acceptance criteria met
- [x] `pnpm test`, `pnpm test:api`, lint, build pass; no scratch data in `dev.db`; backup retained (`prisma/dev.db.bak-2026-09-30-savings`, untracked)
- [x] Ready for review
