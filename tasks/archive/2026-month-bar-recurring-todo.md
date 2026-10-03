# Todo: Global month bar + separate Recurring Payments page

Plan: `tasks/plan.md` (v2). Checks for each task: `pnpm lint` + a browser check. Final: `npx prisma validate`, `pnpm test`, `pnpm test:api`, `pnpm build`. No schema/DB changes.

## Phase 1 — Global month bar

- [x] **T1 Route registry + MonthContextBar in layout** (Medium)
  - Acceptance:
    - [x] `src/lib/navigation.ts` exports `NAV_GROUPS` and `isMonthScopedPath`; month-scoped: `/`, `/expenses`, `/savings`, `/alerts`, `/calendar`
    - [x] `MonthContextBar` is rendered once in `layout.tsx` above `<main>`, lined up with the `max-w-7xl` content; sticky on desktop (top 0) and on mobile (below the header via `--app-header-h`); label + `MonthSwitcher` + current/past/future chip (on mobile the chip becomes a coloured dot so the bar stays on one line, 55px)
    - [x] Hidden on `/recurring`, `/wallet`, `/profile`, `/invite/*`, auth pages, and when there is no `walletData`
  - Verify: `pnpm lint`; browser at 1280px and 390px: same position on all 5 pages, stays while scrolling, popover not clipped, nothing hidden under the mobile header; changing the month updates the page data
  - Depends: none
  - Files: `src/lib/navigation.ts` (new), `src/components/month-context-bar.tsx` (new), `src/app/layout.tsx`, `src/app/globals.css`, `src/components/sidebar.tsx` (header height variable only), `src/lib/i18n/dictionaries/{en,el}.ts`

- [x] **T2 Remove the per-page month switchers** (Medium)
  - Acceptance:
    - [x] `MonthSwitcher` is imported only by `month-context-bar.tsx`; removed from dashboard, expenses, savings, alerts empty state, `UnpaidBillsBanner`, Calendar toolbar
    - [x] Headers look tidy; the "review earliest month" button in the banner still changes the month, and the bar shows it
  - Verify: `pnpm lint`; grep `MonthSwitcher`; screenshots of the 5 pages in en + el
  - Depends: T1
  - Files: `src/app/page.tsx`, `src/app/expenses/page.tsx`, `src/app/savings/page.tsx`, `src/app/alerts/page.tsx`, `src/components/unpaid-bills-banner.tsx`, `src/app/calendar/page.tsx`

## Checkpoint A
- [x] `pnpm lint`, `pnpm build` pass (+ `pnpm test`, `tsc --noEmit`, `check-i18n`)
- [x] One month control at the same position on all month-scoped pages (desktop 1280 + mobile 390/360; Calendar follows the bar)
- [x] Human review before Phase 2 (approved)

## Phase 2 — Recurring Payments page + menu

- [x] **T3 `/recurring` page** (Medium)
  - Acceptance:
    - [x] `pickNextOccurrences(invoices)` in `recurrence.ts` (the existing fallback branch of `pickSeriesOccurrences`, extracted and shared): one per `seriesId`, earliest unpaid, else latest; covered in `scripts/test-recurrence.ts`
    - [x] New `src/app/recurring/page.tsx` with `RecurringPaymentsSection` (moved from `components/calendar/subscriptions-section.tsx`): the same cards no matter which month is chosen; add / edit / delete / pay work as before; monthly-equivalent cost unchanged; subtitle no longer mentions "selected month" (en + el)
    - [x] The Calendar no longer renders the section; header copy updated, with a "Recurring payments →" link; the Calendar's grid/list unchanged
  - Verify: `tsx scripts/test-recurrence.ts`; `pnpm lint`; browser: change the month in the bar → `/recurring` stays the same (checked Sep/Dec/Mar); "Add recurring bill" opens the form with recurring pre-checked (fix: `openAddInvoice(…, recurring)`); pay flow unchanged (API untouched, covered by `pnpm test:api`; not clicked in the UI so dev data stayed as it was)
  - Depends: T2
  - Files: `src/lib/recurrence.ts`, `scripts/test-recurrence.ts`, `src/app/recurring/page.tsx` (new), `src/components/recurring/recurring-payments-section.tsx` (moved), `src/app/calendar/page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`

- [x] **T4 Grouped menu** (Medium)
  - Acceptance:
    - [x] Sidebar builds the menu from `NAV_GROUPS` (the flat `navLinks` array is removed). Groups: Monthly view (Overview, Alerts, Expenses, Savings, Calendar) with the chosen month in the heading / Recurring (Recurring Payments) / Manage (Wallet & Team)
    - [x] Desktop expanded = headings; collapsed = dividers; drawer = headings; bottom bar = 5 links (`mobileBar`) with a divider; alert badge kept (sidebar + bell)
  - Verify: `pnpm lint`; browser: desktop expanded/collapsed, drawer, bottom bar at 360px and 390px, en + el; active state correct on every route, including `/recurring`
  - Depends: T1, T3
  - Files: `src/components/sidebar.tsx`, `src/lib/navigation.ts`, `src/lib/i18n/dictionaries/{en,el}.ts`

## Checkpoint B
- [x] `pnpm test`, `pnpm test:api`, `pnpm lint`, `pnpm build` pass (+ `prisma validate`, `tsc --noEmit`)
- [x] Browser check: en + el, desktop expanded/collapsed, mobile 390/360 (mock auth; normal-auth login not exercised — layout-only change)
- [x] Human review

## Phase 3 — Close-out

- [x] **T5 Docs + final verification** (Small)
  - Acceptance:
    - [x] `AGENTS.md` §4: subscriptions are managed on `/recurring` (not `/calendar`); §6: global `MonthContextBar`, `NAV_GROUPS`/`isMonthScopedPath` is the only source for month-scoped routes (+ `README.md`)
    - [x] All new strings in `en.ts` + `el.ts`; old `subscriptions-section.tsx` and unused keys (`recurringPaymentsTitle`, `recurringPaymentsSubtitle`) removed
  - Verify: `tsx scripts/check-i18n.ts`, `tsx scripts/test-i18n-check.ts`, `npx prisma validate`, `pnpm test && pnpm test:api && pnpm lint && pnpm build`
  - Depends: T1–T4
  - Files: `AGENTS.md`, `src/lib/i18n/dictionaries/{en,el}.ts`

## Checkpoint: Complete
- [x] All acceptance criteria met; ready for review
