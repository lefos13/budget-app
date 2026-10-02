# Implementation Plan: Global month bar + separate Recurring Payments page

Status: **DRAFT v2 — awaiting human review.** v2 adds a correction: the Calendar follows the global month. The section that doesn't depend on the month is "Recurring Payments", and it moves to its own page.
Previous plan (monthly bonus, all done) archived at `tasks/archive/2026-monthly-bonus-{plan,todo}.md`. No SPEC.md exists; the request + `AGENTS.md` are the spec.

## Overview

1. Today the month picker (`MonthSwitcher`) is placed by hand on 6 spots, each in a different position. Replace them with **one fixed month bar** at the top of the content area, on every page that depends on the chosen month, **Calendar included**.
2. The **Recurring Payments** section (`SubscriptionsSection`, now at the top of `/calendar`) is a list of the recurring series you have: subscriptions and fixed bills, with their monthly cost. It is not a view of one month. It moves to **its own page `/recurring`**, outside the month group in the menu, and no longer pretends to depend on the month.

## Findings (current code)

- `MonthSwitcher` is rendered in: `src/app/page.tsx:79`, `src/app/expenses/page.tsx:339`, `src/app/savings/page.tsx:139`, `src/app/alerts/page.tsx:135` (empty state), `src/components/unpaid-bills-banner.tsx:123`, `src/app/calendar/page.tsx:109`. They all use the global `selectedMonth` (`AppContext`, `localStorage.aura_selected_month`).
- The Calendar (`month-grid.tsx`, `bills-list-view.tsx`, `day-agenda-drawer.tsx`) follows the global month properly: bills filtered by `getMonthBounds(selectedMonth)`, expenses from `walletData.monthExpenses`. **No change to its data.**
- **Why "Recurring Payments" looks unaffected by the month** (`src/components/calendar/subscriptions-section.tsx`):
  - `pickSeriesOccurrences` (`src/lib/recurrence.ts:85-107`) always returns **one card per series, in every month**. If the series has no occurrence in that month, it falls back to "earliest unpaid occurrence overall". In a future month (e.g. December), only the next pending row exists (rows are created when you pay), so you see the **same card** ("Next: Oct 5", Pending) as in October.
  - The totals use `monthlyEquivalent` (yearly ÷ 12, weekly × 52/12), so they are **the same in every month**.
  - Only past months show something different (the row paid that month).
  - The subtitle says "…for the selected month" (`bills.recurringPaymentsSubtitle`), which is misleading.
- So the section is a **list of series with their monthly cost**, not a month view. Its meaning doesn't fit inside the month-scoped Calendar.
- Navigation: flat `navLinks` in `src/components/sidebar.tsx:129-146`, drawn 3 times (mobile drawer `:285`, desktop aside `:717`, bottom bar `:992`). The mobile header is `sticky top-0 z-40` with an Alerts bell.
- Links to `/calendar` from `alerts/page.tsx`, `upcoming-bills-card.tsx`, `urgent-reminders-banner.tsx` are about bills / due dates, so they stay as they are.
- `AGENTS.md` §4: "Subscriptions live on the bills page (`/calendar`)". This must be updated.

## Architecture decisions

1. **One route registry**: new `src/lib/navigation.ts` exports `NAV_GROUPS` (groups → `{ href, labelKey, icon, monthScoped, mobileBar }`) and `isMonthScopedPath(pathname)`. The sidebar, the bottom bar and the month bar all read from here.
2. **`MonthContextBar`** (new `src/components/month-context-bar.tsx`), rendered once in `layout.tsx` above `<main>`, with the same `max-w-7xl` + padding as the content. Sticky: `top-0` on desktop; on mobile just below the header via the `--app-header-h` CSS variable (`globals.css`). Contents: label "Viewing month", the existing `MonthSwitcher` (prev / picker / next / Today), and a current / past / future month chip. Shown on `/`, `/expenses`, `/savings`, `/alerts`, `/calendar`. Hidden on `/recurring`, `/wallet`, `/profile`, `/invite/*`, auth pages, and when there is no `walletData`. `z-30` < header `z-40` < modals `z-50`.
3. **New page `/recurring`** ("Recurring Payments") with `RecurringPaymentsSection`: the current section moved out of the Calendar and renamed. One card per series, showing **the next unpaid occurrence** (if all are paid: the latest). Not tied to any month window. Monthly-equivalent cost stays as is (that's what it is for). Actions: add subscription / recurring bill, edit, delete, "Mark as paid". Paying acts on the next occurrence and rolls the series forward, exactly as today. The pay logic doesn't change; only which occurrence is selected.
4. **Selection helper**: new `pickNextOccurrences(invoices)` in `src/lib/recurrence.ts`, taken from the existing fallback branch of `pickSeriesOccurrences` (same code, no duplicate). `pickSeriesOccurrences` stays for the places that need a month (AGENTS §4: collapse a series per period).
5. **Calendar**: loses the section. Keeps "Add bill/invoice" and ICS export. Header copy updated (no more "recurring subscriptions, burn rate"). Recurring items for the month still show in the grid/list as before.
6. **Menu grouping**:
   - **Μηνιαία εικόνα · {Οκτ 2026}** / *Monthly view*: Overview, Alerts, Expenses, Savings, Calendar.
   - **Πάγια** / *Recurring*: Recurring Payments.
   - **Διαχείριση** / *Manage*: Wallet & Team.
   - Desktop expanded: group headings. Collapsed: dividers. Mobile drawer: headings.
   - **Bottom bar**: 7 links don't fit at 360px. It shows 5: Overview, Expenses, Calendar, Savings, Recurring. Alerts is already the bell in the mobile header; Wallet & Team is in the drawer. A divider separates the month group from Recurring.
7. **No API/schema changes**; `prisma/dev.db` is not touched.

## Dependency graph

```
src/lib/navigation.ts (NAV_GROUPS, isMonthScopedPath)
   ├── MonthContextBar + layout.tsx ──► remove the 6 per-page MonthSwitchers
   └── Sidebar grouping (desktop / drawer / bottom bar)
recurrence.ts pickNextOccurrences (+ test)
   └── /recurring page + RecurringPaymentsSection ──► Calendar without the section
                                                  └── nav entry (needs NAV_GROUPS)
i18n en/el ── bar, groups, /recurring, copy fixes
AGENTS.md §4/§6 ── at the end
```

## Task list (vertical slices)

### Phase 1 — Global month bar (riskiest: layout, sticky)
- **T1** Route registry + `MonthContextBar` in the layout (5 month-scoped pages, including Calendar).
- **T2** Remove the 6 per-page `MonthSwitcher` instances; clean up headers and the Calendar toolbar.

### Checkpoint A — one month control at the same position on every month-scoped page

### Phase 2 — Recurring Payments page + menu
- **T3** `/recurring` page: `pickNextOccurrences` + test, section moved / renamed, copy fixed, removed from the Calendar.
- **T4** Grouped menu from `NAV_GROUPS` (desktop, drawer, bottom bar of 5), with the chosen month in the group heading.

### Checkpoint B — full browser check (desktop expanded/collapsed, mobile 360/390, en + el)

### Phase 3 — Close-out
- **T5** `AGENTS.md` §4 (subscriptions on `/recurring`) + §6 (global bar, route registry); i18n checks; full verification.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sticky bar overlaps the mobile header / month picker popover gets clipped | High | Shared `--app-header-h` variable, `z-30` < `z-40`, no `overflow-hidden` on the bar; check at 390px and 1280px with the popover open |
| Wrong occurrence selected on `/recurring` (e.g. a paid one while an unpaid one exists) → wrong "Mark as paid" | High | `pickNextOccurrences` covered in `scripts/test-recurrence.ts`: unpaid before paid, all paid → latest, several series, separation by `seriesId` |
| Users look for subscriptions in the Calendar out of habit | Med | Calendar header shows a link "Recurring payments →"; `/recurring` is in the menu and in the drawer |
| Bottom bar loses Alerts / Wallet | Med | Alerts stays as the bell with badge in the mobile header; Wallet in the drawer; check at 360px |
| A future month in the Calendar shows only the next occurrence of each series (rows are created on payment) | Med (existing) | Out of scope. Possible follow-up: virtual future occurrences in the grid (see Q3) |
| `GET /api/expenses` without an auth/membership check (existing) | Med (security) | Out of scope; flagged for a separate fix |

## Open questions (defaults chosen)

- **Q1** Page / group name: default "Πάγιες Πληρωμές" under the "Πάγια" group (EN "Recurring payments" / "Recurring"). Alternative: "Συνδρομές & Πάγια".
- **Q2** Bottom bar: default 5 links (without Alerts and Wallet, which are in the bell and the drawer). Alternative: keep all of them, with smaller labels.
- **Q3** Should the Calendar show projected future occurrences of recurring items (e.g. Netflix in December, before October is paid)? Default: **no, separate task later**. It would need virtual occurrences in the grid and list.
- **Q4** What goes in the month bar: default switcher + chip. Alternative: also the remaining budget.
