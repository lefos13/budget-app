# Todo: Monthly bonus budget

Plan: `tasks/plan.md`. Verify gate per task: `npx prisma validate`, `pnpm lint`, relevant scripts; final: `pnpm test`, `pnpm test:api`, `pnpm build`.

## Phase 1 — Core

- [x] **T1 Schema + math + wallet GET** (Medium)
  - Acceptance:
    - [x] `MonthBonus` model + additive migration (no reset of `prisma/dev.db`)
    - [x] `src/lib/month-bonus.ts` (`sumBonusForMonth`, `effectiveBudget`) replaces ad-hoc `monthlyBudget + boost` in wallet GET and `month-projection.ts`
    - [x] Wallet GET returns `metrics.bonus`, `bonuses`; `remainingBudget` and `projection` include the bonus only for its month
  - Verify: `npx prisma validate`; extended `scripts/test-month-projection.ts` (bonus cases, other month unaffected); `pnpm lint`
  - Depends: none
  - Files: `prisma/schema.prisma`, new migration, `src/lib/month-bonus.ts`, `src/lib/month-projection.ts`, `src/app/api/wallets/[id]/route.ts`, `src/context/AppContext.tsx`

- [x] **T2 Add a bonus (API + modal + display)** (Medium)
  - Acceptance:
    - [x] `POST /api/wallets/[id]/bonuses` `{ amount>0, month, label? }`: OWNER 201; MEMBER/VIEWER 403; bad amount/month 400; writes `ActivityLog`
    - [x] "Add bonus" button + modal on budget overview card for the viewed month
    - [x] Budget card, projection card, sidebar show the raised budget and "incl. +€X bonus"; `monthlyBudget` setting untouched
  - Verify: API script asserts; browser: add €200 to a month → gauge/remaining/projection/sidebar all +200, next month unchanged, wallet setting still shows baseline
  - Depends: T1
  - Files: `src/app/api/wallets/[id]/bonuses/route.ts`, `src/components/modals/add-bonus-modal.tsx` (new), `src/components/budget-overview-card.tsx`, `src/components/month-projection-card.tsx`, `src/components/sidebar.tsx` (if needed)

## Checkpoint A
- [x] `pnpm test`, `pnpm test:api`, `pnpm lint`, `pnpm build` pass
- [x] Add-bonus flow works in browser (mock + normal auth)
- [x] Human review before Phase 2

## Phase 2 — Manage and persist

- [x] **T3 List + delete bonuses** (Small–Medium)
  - Acceptance:
    - [x] `DELETE /api/wallets/[id]/bonuses/[bonusId]` OWNER only, scoped to wallet (other-wallet id → 404)
    - [x] Month's bonuses listed (amount, label, who) with delete; totals update immediately; activity log entry
  - Verify: API script (403/404/200); browser delete lowers budget back
  - Depends: T2
  - Files: `src/app/api/wallets/[id]/bonuses/[bonusId]/route.ts`, `src/components/budget-overview-card.tsx` (list), modal/list component

- [x] **T4 Export/import 2.2** (Small–Medium)
  - Acceptance:
    - [x] Export format `2.2` includes `monthBonuses`; import recreates them atomically (user mapping as for ledger)
    - [x] Importing a `2.1` file still works (no bonuses)
  - Verify: extend `scripts/test-wallet-roundtrip.ts` (round-trip + 2.1 file)
  - Depends: T1
  - Files: `src/app/api/wallets/[id]/export/route.ts`, `.../import/route.ts`, `scripts/test-wallet-roundtrip.ts`

- [x] **T5 Copy, i18n, activity labels** (Small)
  - Acceptance:
    - [x] Monthly Target Budget helper text: baseline; add bonuses per month from the dashboard
    - [x] All new strings in `en.ts` and `el.ts`; `BONUS_ADDED/BONUS_REMOVED` activity labels; api-error keys
  - Verify: `tsx scripts/check-i18n.ts`, `tsx scripts/test-i18n-check.ts`, `tsx scripts/test-api-errors.ts`; toggle language in browser
  - Depends: T2, T3
  - Files: `src/lib/i18n/dictionaries/{en,el}.ts`, `src/lib/i18n/api-errors.ts`, `src/app/wallet/page.tsx`

## Checkpoint B
- [x] All suites green; export→import round-trip keeps bonuses
- [x] Greek and English UIs complete
- [x] Human review

## Phase 3 — Close-out

- [x] **T6 Docs + regression tests** (Small)
  - Acceptance:
    - [x] `AGENTS.md` §4: bonus rule (external money, month-scoped, not an Expense/savings, owner-only, export 2.2)
    - [x] `scripts/test-month-bonus.ts` wired into `package.json` `test`/`test:api`; no scaffolds left
  - Verify: `pnpm test && pnpm test:api && pnpm lint && pnpm build`; grep shows no remaining ad-hoc `monthlyBudget + …boost` sums
  - Depends: T1–T5
  - Files: `AGENTS.md`, `scripts/test-month-bonus.ts`, `package.json`

## Checkpoint: Complete
- [x] All acceptance criteria met; ready for review
