# Implementation Plan: Monthly bonus budget (extra budget per month)

Status: **IMPLEMENTED (2026-09-30) — T1–T6 done; verified with pnpm test, pnpm test:api, lint, build and a browser add/remove walkthrough.**
Previous plan (savings buckets, all done) archived at `tasks/archive/2026-savings-buckets-{plan,todo}.md`. No SPEC.md exists; the request + `AGENTS.md` are the spec.

## Overview

`Wallet.monthlyBudget` ("Monthly Target Budget") stays a stable baseline. Today the only way to add budget to a single month is `BUDGET_BOOST`, which **only** moves money out of General savings (`src/app/api/savings/[bucketId]/boost/route.ts`). The user wants *extra* money for one month (bonus, gift, salary extra) added to that month's budget **without touching the baseline and without needing savings**. Add a per-month **bonus** record: `effectiveBudget(month) = monthlyBudget + boost (from General) + bonus`.

## Findings (current code)

- Effective budget is computed in 4 places: `api/wallets/[id]/route.ts` (`remainingBudget`, `metrics`), `lib/month-projection.ts` (`budget + boost`), `components/budget-overview-card.tsx` (`monthlyBudget + savings.boost`), `components/month-projection-card.tsx` (`projection.budget + projection.boost`). Sidebar reads `metrics.remainingBudget`.
- Wallet export is format `2.1` (`api/wallets/[id]/export`), import atomic (`.../import`). New data must round-trip.
- Owner-only for editing the budget target (AGENTS.md §4). Activity log entry per mutation; i18n en+el with `check-i18n.ts`; API errors go through `lib/i18n/api-errors.ts`.
- AGENTS.md rule: "Sub-bucket money MUST NEVER go straight to the monthly budget" — unaffected: a bonus is **external** money, not savings, and creates no `SavingsTransaction`/`Expense`.

## Architecture decisions

1. **New model `MonthBonus`** `{ id, walletId, monthKey "YYYY-MM", amount Float >0, label String?, userId, createdAt }`, index `(walletId, monthKey)`. A month can hold several bonuses (each listable/deletable). Rejected: a `Float` per-month column/JSON on Wallet (no history, no per-item delete, no audit); reusing `BUDGET_BOOST` (would require fake savings money and violates the ledger invariant).
2. **Bonus is neither an `Expense` nor a savings movement.** It only raises that month's budget. Does not carry over to other months (bonus scoped to `monthKey`; unspent bonus is not auto-saved — user can deposit to savings like any leftover).
3. **Single source of truth for the sum**: new pure helper `src/lib/month-bonus.ts` (`sumBonusForMonth`, `effectiveBudget({monthlyBudget, boost, bonus})`), used by wallet GET, projection and UI, replacing the 4 ad-hoc `monthlyBudget + boost` sums.
4. **API**: `GET/POST /api/wallets/[id]/bonuses?month=YYYY-MM`, `DELETE /api/wallets/[id]/bonuses/[bonusId]`. Wallet GET also returns `metrics.bonus` (month total) and `bonuses` (month list) so the dashboard needs no extra fetch.
5. **Permissions (default, see Q1)**: OWNER only may add/delete (it changes the budget like the target does); MEMBER/VIEWER → 403; any member may read.
6. **Migration is additive** (`prisma migrate dev --create-only`); `prisma/dev.db` is never reset.
7. **Export/import → format `2.2`** (additive): `monthBonuses` array; older files import with none.

## Dependency graph

```
schema + migration (MonthBonus)
   │
   ├── lib/month-bonus.ts (pure math) ── month-projection.ts (bonus input)
   │        │
   │        └── wallet GET metrics (bonus, remainingBudget, projection)
   │                 │
   │                 ├── display: budget card, projection card, sidebar
   │                 └── bonuses API (POST/DELETE) ── Add-bonus UI (+ list/delete)
   │
   └── export/import 2.2
i18n (en/el) used by every UI slice; AGENTS.md + tests close out.
```

## Task list (vertical slices)

### Phase 1 — Add a bonus and see it affect the month (core path)
- **T1** Schema + pure math + wallet GET: a bonus row raises `remainingBudget`, `metrics.bonus`, and the projection for its month only.
- **T2** Create a bonus end-to-end: `POST` API (owner-only, validation, activity log) + "Add bonus" modal on the dashboard budget card for the viewed month + card/projection display ("incl. +€X bonus").

### Checkpoint A — core flow works end-to-end

### Phase 2 — Manage and persist
- **T3** List + delete bonuses for the month (`DELETE` API, list in card/popover, activity log).
- **T4** Export/import format 2.2 round-trip.
- **T5** Wallet settings clarity: copy on Monthly Target Budget explaining it is the baseline and bonuses are added per month; i18n en/el keys for all new strings; `ACTIVITY` labels; api-error keys.

### Checkpoint B — complete

### Phase 3 — Close-out
- **T6** Docs + regression: AGENTS.md §4 domain rule; `scripts/test-month-bonus.ts` (+ projection cases) wired into `pnpm test` / `test:api`; full verification.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Missing one of the 4 effective-budget sites → inconsistent numbers | High | Single helper (T1); grep for `monthlyBudget +` before done; browser check of card, projection, sidebar agree |
| Per-month scoping / timezone at month edges | Med | Store `monthKey` string from existing `lib/month.ts` (same as the viewed month), not a Date |
| Import of old backups | Med | `monthBonuses` optional; test importing a 2.1 file |
| Category-limit warning (`isLimitsOverBudget`) compares to baseline only | Low | Leave baseline-based (limits are a recurring setup, not per-month) |
| Bonus hides overspending pacing | Low | Pacing uses effective budget, same as boost today |

## Open questions (need your call; defaults chosen)

- **Q1** Who may add/delete bonuses? Default: **OWNER only**. Alternative: OWNER+MEMBER.
- **Q2** Should a bonus be scoped to one month only (default) or allow "apply to a range / recurring"? Default: one month only.
- **Q3** Should an optional free-text label (e.g. "Christmas bonus") be kept? Default: yes, optional.
- **Q4** Can bonuses be added to past/future months? Default: yes, any month (viewed month), as with `BUDGET_BOOST` dates.
