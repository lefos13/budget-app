# Implementation Plan: Public landing page with coded product mockups

Status: **DRAFT v1, awaiting human review.**
The previous plan (global month bar + Recurring page, all done) is archived at `tasks/archive/2026-month-bar-recurring-{plan,todo}.md`. There is no SPEC.md, so the spec is this request plus `AGENTS.md`.

Decisions already made by the user:
- Mockups are **coded** (React/Tailwind with fake data, no screenshots).
- The landing page lives at **`/`** and is shown to logged-out visitors. Logged-in users still get the dashboard there.

## Overview

Build a marketing landing page that visitors see before they log in. It has:
- a hero with a large product mockup (desktop browser frame plus an overlapping phone frame);
- 4 feature sections, each with its own mockup (budget pacing, bills calendar + recurring, savings buckets, shared wallets);
- a "how it works" strip, a final call to action and a footer.

The page is in English and Greek, works in light and dark mode, is responsive from 360px to 1440px, and respects reduced-motion settings. The real app's chrome (sidebar, mobile header, bottom bar, month bar) is never shown on it.

## Findings (current code)

- **Auth is client-only.** `AppProvider` (`src/context/AppContext.tsx:373-428`) loads the user (`/api/auth/me` in normal mode, `/api/users` in mock mode). In normal mode, a logged-out user on any page other than `/login`, `/register` or `/invite/*` is sent to `/login` (`:416-428`). `authMode` comes from `localStorage.aura_auth_mode`, falling back to `NEXT_PUBLIC_AUTH_MODE`, falling back to `mock`. The server cannot know the mode.
- **Mock mode never has a logged-out user** (it always picks `users[0]`). So the landing page can only be reached in **normal** mode. To see it in dev, switch to Normal mode and log out.
- **The chrome is hidden in two places with the same duplicated check**:
  - `sidebar.tsx:117` hides on `/login` and `/register`;
  - `AppContext.tsx:418` defines `isAuthPage` and `isPublicPage`.

  `MonthContextBar` already hides when there is no `walletData`.
- **The layout constrains the content.** `layout.tsx:45` wraps every page in `<main class="max-w-7xl … px-4 … pb-[6.5rem]">`. A landing page needs full-bleed sections, so this has to change for the landing view only.
- **`src/app/page.tsx` is a client component.** While loading it shows a spinner; with no wallet it shows a "create first wallet" empty state.
- **Visual language:**
  - indigo→sky gradient logo tile;
  - `rounded-3xl` cards with `border-zinc-200/80`;
  - `font-black` headings;
  - radial indigo glow (`layout.tsx:38`);
  - Geist font;
  - dark mode via `prefers-color-scheme` (`globals.css:16`);
  - Lucide icons.

  Mockups should reuse these exactly, so the mockups look like the real app.
- **i18n**: `useTranslation()`, with dictionaries in `src/lib/i18n/dictionaries/{en,el}.ts`. `scripts/check-i18n.ts` flags:
  - hardcoded JSX text;
  - string attributes `title`, `alt`, `aria-label`, etc.;
  - object keys named `label`, `title`, `name`, `description`… (`LABEL_KEY_REGEX`).

  So the **mockup fixture labels must be dictionary keys** (`landing.mock.*`). Only amounts and dates may be literals. The language toggle exists only inside the sidebar, so the landing page needs its own.
- **`formatCurrency`** (`src/lib/formatters.ts`) formats mockup amounts so they follow the locale.
- **Tests are tsx scripts.** `pnpm test` runs `check-i18n.ts` and the logic tests. There is no browser test harness, so UI is verified manually in the browser.

## Architecture decisions

1. **One pure predicate for "public landing view".** Add `isLandingView({ pathname, authMode, isAuthLoading, hasUser })` to `src/lib/navigation.ts`. It is true only when all of these hold: `pathname === '/'`, `authMode === 'normal'`, auth has finished loading, and there is no user. Also move the duplicated auth-page check into `isAuthPath(pathname)` / `isPublicPath(pathname)` in the same file, and use those in `sidebar.tsx` and `AppContext.tsx`. A tsx test covers the precedence rules (`scripts/test-navigation.ts`, added to `pnpm test`).
2. **Route protection.** `/` becomes public for logged-out users: no redirect to `/login` from `/`. Every other private route still redirects to `/login`.
3. **App shell decides the chrome.** A new client `src/components/app-shell.tsx` takes over the body of `layout.tsx` (Sidebar, MonthContextBar, `<main>`).
   - Landing view: renders `children` full-bleed, with no Sidebar, no MonthContextBar and no `max-w`/padding.
   - Otherwise: the current markup, unchanged.

   `layout.tsx` stays a server component that keeps the metadata and global modals.
4. **No chrome flash.** In normal mode, while auth is loading on `/`, the shell shows a neutral full-screen splash (logo plus spinner), not the sidebar plus dashboard spinner. Mock mode keeps today's behaviour.
5. **Folder layout under `src/components/landing/`:**
   - `landing-page.tsx`: composes the sections;
   - `sections/*`: hero, features, how-it-works, CTA, footer, header;
   - `mockups/*`: `BrowserFrame`, `PhoneFrame`, and one presentational mockup per feature.

   Mockups are **pure presentational** (props or fixture only, no `useApp`), so they can't break or leak real data.
6. **Fake data** lives in `src/components/landing/mockups/fixture.ts`. It holds numbers and dates, plus **dictionary keys** for every label. Mockup text comes from `t.landing.mock.*`, so the mockups switch language with the page.
7. **Mockups are decorative.** Each one is a `role="img"` with a translated `aria-label` that describes it, and its inner content is `aria-hidden`. They have no focusable elements inside.
8. **Motion is CSS only.**
   - Gentle float or tilt on the hero frames.
   - Fade-up on scroll, using an `IntersectionObserver` hook that toggles a `data-visible` attribute.
   - Everything is disabled under `prefers-reduced-motion`.
   - No new dependencies.
9. **Landing header**: logo, a compact EN/ΕΛ toggle (`setLanguage`), "Log in" → `/login`, and "Get started" → `/register`. It is sticky with a blurred background, like the existing header.
10. **No schema/API changes**, and `prisma/dev.db` is not touched. The static SEO `metadata` in `layout.tsx` stays as it is (see Q2).
11. **Next 16**: before using any Next API (`Link`, `usePathname`, metadata, `next/font`), check `node_modules/next/dist/docs/` as `AGENTS.md` requires.

## Dependency graph

```
navigation.ts: isAuthPath / isPublicPath / isLandingView (+ test)
   ├── AppContext route protection (/ public when logged out)
   ├── sidebar.tsx uses isAuthPath
   └── app-shell.tsx (chrome on/off, splash) ◄── layout.tsx
            └── src/app/page.tsx → <LandingPage/> when isLandingView
                     └── landing/landing-page.tsx
                           ├── sections/landing-header (lang toggle, CTAs)
                           ├── mockups/ frames + fixture + i18n landing.mock.*
                           │     ├── hero mockup        → sections/hero
                           │     ├── budget + calendar  → sections/features (1, 2)
                           │     └── savings + wallets  → sections/features (3, 4)
                           └── sections/how-it-works, final CTA, footer
i18n en/el `landing.*` ── grows with each slice
AGENTS.md §3/§6 + README ── at the end
```

## Task list (vertical slices)

### Phase 1: Public route + hero (riskiest: auth gating and layout)
- **T1** Landing gating + shell: the logged-out `/` shows a minimal landing (header + hero copy + CTAs), with no chrome and no flash. Logged-in and mock users are unchanged.
- **T2** Mockup kit + hero mockup: browser/phone frames, the fixture, and the dashboard mockup in the hero, in en/el and light/dark.

### Checkpoint A: logged-out `/` is a landing page with a hero mockup; every other auth flow is unchanged

### Phase 2: Feature sections
- **T3** Features 1–2: "Know your pace" (budget gauge + pacing + categories) and "Never miss a bill" (calendar + recurring + .ics) sections, with mockups.
- **T4** Features 3–4: "Save for what's next" (savings buckets) and "Budget together" (shared wallet, roles, invites) sections, with mockups.

### Checkpoint B: browser review of the whole scroll in en/el, light/dark, 360/390/768/1280/1440

### Phase 3: Finish + close-out
- **T5** "How it works" (3 steps), FAQ (accordion), final CTA band, footer, scroll-reveal motion with a reduced-motion fallback.
- **T6** Polish pass (a11y, contrast, CLS/perf, no horizontal scroll), docs (`AGENTS.md`, README), and full verification.

### Checkpoint: Complete

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Logged-in user briefly sees the landing page (or a logged-out user sees the dashboard chrome) during auth load | High | `isLandingView` needs `!isAuthLoading`; neutral splash while loading in normal mode; tested in `test-navigation.ts`; browser check with a throttled network |
| Opening up `/` weakens route protection | High | Only `/` becomes public, and only for the landing render. The dashboard needs `currentUser` and wallet APIs already check the session server-side. Check that `/expenses` etc. still redirect to `/login` |
| Mock mode (dev default) never shows the landing page, so it goes unreviewed | Med | Documented in AGENTS §3 (switch to Normal and log out). Q1 offers a dev preview route |
| Landing content is client-rendered (auth is client-only) → weak SEO, and the first paint is the splash | Med | Accepted for v1 (Q2); static metadata remains. A server-side cookie check could come later |
| `check-i18n` fails on fixture labels or literal mockup text | Med | Fixture stores dictionary keys; run `pnpm i18n:check` in every task |
| Greek text is ~30% longer and breaks headline and mockup layouts | Med | Every task checks `el` at 360px; mockup labels use `truncate`; headlines use `text-balance` |
| Mockups get heavy (many DOM nodes) and hurt mobile performance | Low | Pure CSS/SVG, no images; on `<md` the phone frame is shown and the desktop frame hidden |
| Mockups drift from the real UI over time | Low | Same Tailwind tokens and icons as the real cards; listed as a docs note |

## Decisions on open questions (answered 2026-10-03)

- **Q1** Dev preview: **no**. To see the page, switch to Normal mode and log out.
- **Q2** SEO: client-rendered landing content is **accepted for now**.
- **Q3** Logout: **in normal mode it goes to `/`** (the landing page). Mock mode keeps `/login`, because in mock mode `/` always shows the dashboard. Done in T1 (`AppContext.logout`).
- **Q4** Copy: "Aura Budget", with the default headlines:
  - EN hero: "Your money, in rhythm with your month."
  - EL hero: "Τα χρήματά σου, στον ρυθμό του μήνα σου."
- **Q5** Add an **FAQ** section only (no pricing, no testimonials), in T5. It is a native `<details>`/`<summary>` accordion of about 6 real questions:
  - Is it free?
  - Can I share a wallet, and what can each role do?
  - How are subscriptions different from expenses?
  - How do savings buckets work?
  - Can I export my data?
  - Is it in Greek?

  Every answer must be true to `AGENTS.md` §4.

## Execution

Subagents use the Paseo profile **"Claude - cognity subagent"** (`claude` / `claude-sonnet-5-5`, mode `auto`, thinking `low`). The orchestrator reviews each task and runs every checkpoint.
