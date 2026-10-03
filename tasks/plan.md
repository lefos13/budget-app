# Implementation Plan: "Support the project" links (GitHub Sponsors + Buy Me a Coffee)

Status: **DONE** (2026-10-03). Implemented by Gemini subagents (Paseo profile "AGY - subagent", `antigravity-cli` / `gemini-3.8-flash`), orchestrated and reviewed by the planner. Verification gap: dark mode follows `prefers-color-scheme` and couldn't be emulated in the automation browser, so the `dark:` styles were checked only by reading the code (they copy the existing cards), not visually.
The previous plan (public landing page, all 44 items done) is archived at `tasks/archive/2026-landing-page-{plan,todo}.md`. There is no SPEC.md; the spec is this request, `AGENTS.md`, and the reference section at https://omnissh-web.vercel.app/#sponsor.

## Overview

Add a way to support the developer, modelled on the OmniSSH "Support OmniSSH Development" section:
- **Landing page (`/`, logged out):** a full section with two cards, **GitHub Sponsors** (`https://github.com/sponsors/lefos13`, monthly or one-time) and **Buy Me a Coffee** (`https://buymeacoffee.com/lefterisev2`, one-off tip), a short "free, no paid plans" pledge, and a subtle footer link that jumps to it.
- **Dashboard (`/`, logged in):** a small, low-contrast strip at the very bottom of the page with the same two links. Not dismissible. It must not compete with budget content.
- **Profile page (`/profile`):** a standard profile card "Support Aura Budget" below the profile form, with the same two links.

No schema, API, or server changes. This is purely presentational.

## Reference section (what we're copying)

OmniSSH `#sponsor`: eyebrow "Community Supported", H2 "Support … Development", one intro paragraph, then two cards side by side:
1. GitHub Sponsors: subtitle "Monthly or one-time sponsor tiers", description, `github.com/sponsors/lefos13`, "View on GitHub" button.
2. Buy Me a Coffee: subtitle "Quick tip & one-off support", description, "Buy me a coffee" button, `buymeacoffee.com/lefterisev2`.
Then a one-line open-source pledge.

We copy the structure and links, not the OmniSSH copy: the text is rewritten for Aura Budget and translated (en + el). We **do not** embed GitHub's `sponsors/<user>/button` / `card` iframes. They are third-party frames that don't follow our theme or language and add an external dependency. Plain links styled as our own buttons do the same job.

## Architecture Decisions

- **One source for the URLs:** `src/lib/support-links.ts` exports `GITHUB_SPONSORS_URL` and `BUY_ME_A_COFFEE_URL` (plus display labels such as `github.com/sponsors/lefos13`). Both surfaces import from here, so nothing is hard-coded twice.
- **One shared link component:** `src/components/support/support-link-buttons.tsx` renders the two external links with a `variant: 'prominent' | 'subtle'`. All links use `target="_blank" rel="noopener noreferrer"` and an sr-only "(opens in a new tab)" label. It does not use `useApp()`, so the landing page can use it too (AGENTS.md says landing components MUST NOT use real data).
- **GitHub icon:** lucide-react 1.48 has no `Github` brand icon (checked `node_modules`), so the shared component includes a small inline SVG GitHub mark with `aria-hidden`. Coffee uses lucide `Coffee`, and the section eyebrow uses `HeartHandshake`.
- **Landing placement:** new `src/components/landing/sections/support.tsx` (`id="support"`, wrapped in `<Reveal>`), placed **between `Faq` and `FinalCta`** so the sign-up CTA stays the last thing on the page. The footer gets a small "Support the project" anchor link to `#support`. The sticky header stays unchanged, because the reference puts "Sponsor" in the header but here it would compete with "Get started".
- **Dashboard placement:** new `src/components/support-strip.tsx`, rendered after `<CategoryBreakdown />` in `Dashboard` (`src/app/page.tsx`). It is one muted line ("Aura Budget is free. If it helps you, you can support its development.") with the two `subtle` links: zinc text, thin border, no colour fill, no shadow. It is not shown in the empty "no wallet yet" state or the loading state, only in the real dashboard.
- **Profile placement:** new `src/components/support/profile-support-card.tsx`, rendered in `src/app/profile/page.tsx` **after the closing `</form>`** (outside the form, so the links never interact with form submit). Same card shell as the other profile cards (`rounded-3xl`, zinc border, `HeartHandshake` icon in the header like `Lock` in the password card), with the `subtle` link buttons. Shown in both auth modes.
- **i18n:** a new top-level `support` dictionary block holding **every key the dashboard strip and profile card need** (shared button labels, new-tab hint, strip text, profile card title/subtitle), plus `landing.support` (section eyebrow, title, intro, card titles/subtitles/descriptions, CTAs, pledge) and `landing.footer.supportLink`, in both `en.ts` and `el.ts`. All of it is added in Task 1, so later tasks never edit the dictionaries. URLs/handles are not translated. `scripts/check-i18n.ts` enforces matching keys and no hard-coded strings.
- **Copy must stay consistent** with FAQ `a1` ("There are no paid plans"). Support is voluntary and unlocks nothing.

## Dependency Graph

```
src/lib/support-links.ts (URLs)
        │
        ├── i18n `support` block (en + el)
        │         │
        └─────────┴── support-link-buttons.tsx (shared, prominent|subtle)
                              │
              ┌───────────────┼────────────────────────────┐
   landing/sections/support.tsx   components/support-strip.tsx   support/profile-support-card.tsx
   + landing-page.tsx (between     + app/page.tsx Dashboard       + app/profile/page.tsx
     Faq and FinalCta)               (bottom)                       (after </form>)
   + landing.support i18n
   + landing-footer.tsx #support link
```

The foundation (URLs, shared buttons, `support` i18n block) is small, so it goes into the first vertical slice instead of being its own horizontal task.

## Task List

### Phase 1: Landing page support section
- [x] Task 1: Visitor can support the project from the landing page (foundation + section + i18n)
- [x] Task 2: Footer link jumps to the support section

### Checkpoint: Landing
- [x] `pnpm run lint`, `npx tsx scripts/check-i18n.ts`, `npx tsx scripts/test-i18n-check.ts` pass
- [x] Landing verified in browser (Normal mode, logged out): en/el, light/dark, mobile 375px + desktop
- [x] Planner review (lint, i18n, browser check) before wave 2. Human approval of the plan already given, so no stop here.

### Phase 2: Logged-in surfaces (parallel)
- [x] Task 3: Logged-in user sees a subtle support strip at the bottom of the dashboard
- [x] Task 4: Logged-in user sees a support card on the profile page

### Checkpoint: Logged-in surfaces
- [x] Strip visible in Mock mode on a wallet with data, absent in empty/loading states
- [x] Profile card visible in Mock and Normal mode, outside the form
- [x] Mobile: neither is covered by the bottom bar

### Phase 3: Docs + full verification
- [x] Task 5: Document support links in AGENTS.md and run the full verification suite

### Checkpoint: Complete
- [x] `npx prisma validate`, `npx tsx scripts/test-e2e.ts`, `pnpm test`, `pnpm run build` pass
- [x] All acceptance criteria met, ready for review

Full task details (acceptance criteria, verification, files) are in `tasks/todo.md`.

## Parallelization

Execution uses Gemini subagents (Paseo profile "AGY - subagent").
- **Wave 1:** one agent does Tasks 1 and 2. It owns every dictionary edit and the shared component.
- **Wave 2 (parallel):** one agent does Task 3 (`support-strip.tsx` + `app/page.tsx`) and another does Task 4 (`profile-support-card.tsx` + `profile/page.tsx`). They touch disjoint files and only read the `support.*` keys from wave 1, so they can't overwrite each other.
- **Task 5:** the planner does it after reviewing wave 2.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dashboard strip feels like an ad or nags users | Med | Bottom of page only, muted styling, one line, no modal/toast/badge, not dismissible (user decision) |
| Copy contradicts "free, no paid plans" | Med | Pledge line says support is voluntary and unlocks nothing; review in Checkpoint: Landing |
| `check-i18n` flags brand strings ("GitHub Sponsors", URLs) as hard-coded | Low | Put titles in dictionaries; keep URLs/handles in `support-links.ts` constants (constants aren't JSX text) |
| Mobile bottom bar overlaps the strip | Low | `<main>` already pads for the bottom bar; verify at 375px |
| External link security | Low | `rel="noopener noreferrer"` on every `target="_blank"` |
| Landing component accidentally uses `useApp()` | Low | Shared button component takes no app state; grep check in Task 1 verification |

## Decisions (resolved 2026-10-03)

1. Dashboard strip is **not dismissible**.
2. Landing gets a **footer link only**; the header is unchanged.
3. **No sidebar link**; add a **profile page card** instead.
4. Links confirmed: `https://github.com/sponsors/lefos13`, `https://buymeacoffee.com/lefterisev2`.
