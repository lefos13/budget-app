# Todo: Public landing page with coded product mockups

See `tasks/plan.md` for findings, decisions, risks and open questions.

These checks apply to every task:
- `pnpm i18n:check` passes (no hardcoded strings; en/el keys match).
- Mockups contain no real user data and do not use `useApp()`.

## Phase 1 — Public route + hero

- [x] **T1 Landing gating + app shell** (Medium)
  - Acceptance:
    - [x] Normal mode, logged out:
      - `/` renders `<LandingPage/>` (header with logo, EN/ΕΛ toggle, "Log in", "Get started" + hero headline/subcopy/CTAs);
      - no sidebar, mobile header, bottom bar or month bar;
      - full-bleed width.
    - [x] Normal mode, logged in: `/` is the dashboard, exactly as before. Mock mode: unchanged. In normal mode, `/expenses`, `/savings` etc. still redirect logged-out users to `/login`.
    - [x] No chrome flash: while auth loads in normal mode, `/` shows a neutral splash (no sidebar).
    - [x] Logout in normal mode goes to `/` (landing). Mock mode keeps `/login`.
    - [x] Clean-up of the duplicated auth-page checks:
      - `isAuthPath` / `isPublicPath` / `isLandingView` live in `src/lib/navigation.ts`;
      - the inline duplicates in `sidebar.tsx` and `AppContext.tsx` are removed.
  - Verify:
    - `tsx scripts/test-navigation.ts`. New test. It covers landing vs dashboard vs splash precedence for:
      - loading / logged in / logged out;
      - normal / mock mode;
      - `/` vs other paths.

      It is added to `pnpm test`.
    - `pnpm lint`, `pnpm build`.
    - Browser:
      - log out in normal mode → `/` shows the landing page;
      - "Log in" → `/login`, then logging in → dashboard;
      - `/expenses` while logged out → `/login`;
      - mock mode `/` → dashboard.
  - Depends: none
  - Files: `src/lib/navigation.ts`, `scripts/test-navigation.ts` (new), `src/context/AppContext.tsx`, `src/components/sidebar.tsx`, `src/components/app-shell.tsx` (new), `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/landing/{landing-page,sections/landing-header,sections/hero}.tsx` (new), `src/lib/i18n/dictionaries/{en,el}.ts`, `package.json`
  - Note: this touches more than 5 files, but the new landing files are thin. If it grows, split into T1a (gating + shell + test) and T1b (header + hero copy).

- [x] **T2 Mockup kit + hero mockup** (Medium)
  - Acceptance:
    - [x] `BrowserFrame` (window dots + URL pill) and `PhoneFrame` (notch, rounded bezel) are reusable and theme-aware (light/dark).
    - [x] `fixture.ts` holds a fake wallet: €2,400 budget, spent/saved split, 4 categories, 3 upcoming bills, 2 savings buckets, 3 members. Every label is a dictionary key under the top-level `landingMock` namespace.
    - [x] Hero mockup:
      - desktop dashboard (remaining-budget gauge, pacing bar, category bars, upcoming bills) in `BrowserFrame`;
      - overlapping `PhoneFrame` with the mobile overview;
      - amounts formatted via `formatCurrency`;
      - text switches en/el.
    - [x] Accessibility: `role="img"` + translated `aria-label`; contents `aria-hidden`; nothing focusable inside.
    - [x] Below `md`, the phone frame is shown on its own; there is no horizontal scroll at 360px (measured `scrollWidth === clientWidth`).
  - Verify: `pnpm lint`, `pnpm i18n:check`. Browser check of the hero at 360/1280/1440, en + el. Dark mode was not rendered (no color-scheme emulation available); it relies on the `dark:` variants.
  - Change made at review: the hero is now **centered and stacked** (copy on top, wide mockup below), because the two-column version clipped the dashboard. The landing header hides the brand text below `sm` (it stays `sr-only`). Greek landing copy uses the informal register throughout (CTA "Ξεκίνα").
  - Depends: T1
  - Files: `src/components/landing/mockups/{browser-frame,phone-frame,fixture,hero-dashboard-mockup}.tsx` (new), `src/components/landing/sections/hero.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`

## Checkpoint A
- [x] `pnpm test`, `pnpm lint`, `pnpm build` pass (+ `prisma validate`, `tsc --noEmit`)
- [x] Browser checks:
  - logged-out `/` shows the landing page;
  - logged-out `/expenses` redirects to `/login`;
  - a logged-in user on `/` gets the dashboard with the sidebar;
  - logout goes to `/` (landing);
  - in mock mode `/` is the dashboard.

  A throwaway user was registered for the smoke test and then deleted along with its wallet.
- [x] Human review of the hero look before building more sections (approved 2026-10-03)

## Phase 2 — Feature sections

- [x] **T3 Features: budget pacing + bills calendar** (Medium)
  - Acceptance:
    - [x] A reusable `FeatureSection` layout: eyebrow, title, body, 3 bullet points, mockup. On desktop the mockup alternates left and right; on mobile it stacks.
    - [x] "Know your pace" section, with a mockup of:
      - [x] the budget gauge, showing spent vs saved vs remaining;
      - [x] a pacing chip ("on track");
      - [x] a month bonus pill.
    - [x] "Never miss a bill" section, with a mockup of:
      - [x] a month calendar grid with due dots;
      - [x] a recurring list (Netflix-style subscription + utility bill, showing the monthly equivalent);
      - [x] an ".ics export" badge.
    - [x] The copy matches the real domain rules (subscriptions are separate from expenses; recurring items are tracked per series).
  - Verify: `pnpm lint`, `pnpm i18n:check`. Browser check at 360/1280, en + el. Dark mode not rendered.
  - Fixes made at review:
    - The bill status is now a due date ("Due 26 Oct") that matches the calendar. It was "Due in 3 days", which contradicted the calendar.
    - The overlapping cards no longer hide the daily pace row or the bill due dots.
  - Depends: T2
  - Files: `src/components/landing/sections/feature-section.tsx` (new), `src/components/landing/mockups/{budget-mockup,calendar-mockup}.tsx` (new), `src/components/landing/landing-page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`

- [x] **T4 Features: savings buckets + shared wallets** (Medium)
  - Acceptance:
    - [x] "Save for what's next" section, with a mockup of:
      - the General bucket plus a goal bucket (progress ring, linked planned expense, target month);
      - a "move money" chip.
    - [x] "Budget together" section, with a mockup of:
      - a wallet member list with OWNER / MEMBER / VIEWER role badges;
      - an email invite card ("Accept" button, visual only).
    - [x] Both use `FeatureSection` from T3 (`sections/features.tsx`). Fixture labels come from the dictionary.
  - Verify: `pnpm lint`, `pnpm i18n:check`. Browser check at 360/1280, en + el. Dark mode not rendered.
  - Depends: T3
  - Files: `src/components/landing/mockups/{savings-mockup,wallet-team-mockup}.tsx` (new), `src/components/landing/landing-page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`

## Checkpoint B
- [x] `pnpm test`, `pnpm test:api` (dev server on :3000), `pnpm lint`, `pnpm build` pass
- [x] Full-scroll browser review: en 1280, el 360. No horizontal overflow (measured). Greek text fits. Dark mode not rendered (no emulation available).
- [x] Human review: the user approved continuing without a pause at this checkpoint. T5 was built in parallel with T3/T4, with all copy written up front.

## Phase 3 — Finish + close-out

- [x] **T5 How it works, FAQ, final CTA, footer, motion** (Medium)
  - Acceptance:
    - [x] "How it works" in 3 steps: create a wallet → set the monthly budget → invite & track.
    - [x] FAQ: about 6 questions in a native `<details>`/`<summary>` accordion that works with the keyboard, en + el. Answers are true to `AGENTS.md` §4: free, roles, subscriptions ≠ expenses, savings buckets, JSON export/import, bilingual.
    - [x] Final CTA band with "Get started" (→ `/register`) and "Log in" (→ `/login`).
    - [x] Footer: logo, language toggle, © year.
    - [x] Motion (CSS reviewed; reduced motion not emulated in the browser):
      - hero frames float;
      - sections fade up via an `IntersectionObserver` hook;
      - under `prefers-reduced-motion: reduce`, nothing moves and everything is visible.
  - Verify: `pnpm lint`, `pnpm i18n:check`. Browser check, including reduced motion emulated via DevTools rendering.
  - Depends: T4
  - Files: `src/components/landing/sections/{how-it-works,final-cta,landing-footer}.tsx` (new), `src/components/landing/use-reveal.ts` (new), `src/components/landing/landing-page.tsx`, `src/app/globals.css`, `src/lib/i18n/dictionaries/{en,el}.ts`

- [x] **T6 Polish, docs, final verification** (Small)
  - Acceptance:
    - [x] Heading order: one `h1`, then `h2` per section and `h3` per feature. CTAs are native links (default focus outline; the FAQ summaries have a focus ring). AA contrast was not measured with a tool.
    - [x] No horizontal scroll at 360px (measured `scrollWidth === clientWidth`). Fonts load through `next/font`.
    - [x] `AGENTS.md` updated:
      - §3: the logged-out `/` shows the landing page (normal mode only), and how to view it in dev;
      - §6: `isLandingView` / `isPublicPath` in `navigation.ts` are the single source for public routes; `AppShell` owns chrome visibility.

      README updated too.
  - Verify: `npx prisma validate`, `npx tsx scripts/test-e2e.ts`, `pnpm test`, `pnpm lint`, `pnpm build`. Browser: final smoke of every T1 flow + a full landing scroll.
  - Depends: T1–T5
  - Files: `AGENTS.md`, `README.md`, landing components (fixes only)

## Checkpoint: Complete
- [x] All acceptance criteria met, apart from the unrendered dark mode and reduced motion and the unmeasured contrast noted above. `prisma/dev.db` has no leftover data: the smoke-test user and wallet were deleted, and the test suites restore their own rows. Ready for review.
