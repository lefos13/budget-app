# Todo: Support links (GitHub Sponsors + Buy Me a Coffee)

Plan: `tasks/plan.md`. Wave 1 (Tasks 1–2) runs first. Wave 2 (Tasks 3 and 4) runs in parallel after the planner has reviewed wave 1. The planner does Task 5.

---

## Phase 1: Landing page support section

### Task 1: Visitor can support the project from the landing page

**Description:** Add the shared foundation (URL constants, shared external-link buttons with an inline GitHub mark, `support` i18n block) and a new landing section `#support` with two cards (GitHub Sponsors, Buy Me a Coffee), an intro paragraph and a pledge line. Place it between `Faq` and `FinalCta`, wrapped in `<Reveal>`, matching the existing section style (eyebrow/H2 pattern from `faq.tsx`, `max-w-*` container, zinc/indigo palette, dark mode).

**Acceptance criteria:**
- [x] Logged-out `/` shows a "Support" section after the FAQ and before the final CTA, with two cards linking to `https://github.com/sponsors/lefos13` and `https://buymeacoffee.com/lefterisev2`. Each link opens in a new tab with `rel="noopener noreferrer"` and has an sr-only new-tab hint.
- [x] All visible text comes from `landing.support.*` / `support.*` keys in both `en.ts` and `el.ts`. The `support` block also already holds the keys for Tasks 3 and 4 (`stripText`, `profileTitle`, `profileSubtitle`, button labels, `opensInNewTab`). URLs live only in `src/lib/support-links.ts`. The copy says support is voluntary and the app stays free (consistent with FAQ `a1`).
- [x] Cards stack on mobile (375px) and sit side by side from `md`. They look right in light and dark mode. No component in `src/components/landing/` or `src/components/support/` imports `useApp`.

**Verification:**
- [x] `npx tsx scripts/check-i18n.ts` and `npx tsx scripts/test-i18n-check.ts` pass
- [x] `pnpm run lint` passes
- [x] `grep -rn useApp src/components/landing src/components/support` returns nothing
- [x] Manual (browser): Normal mode, log out, open `/`. Section renders in en and el, light and dark, at 375px and 1280px. Click both buttons: correct URL opens in a new tab.

**Dependencies:** None

**Files likely touched:**
- `src/lib/support-links.ts` (new)
- `src/components/support/support-link-buttons.tsx` (new)
- `src/components/landing/sections/support.tsx` (new)
- `src/components/landing/landing-page.tsx`
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/el.ts`

**Estimated scope:** Medium (5 files + 1 dictionary pair)

---

### Task 2: Footer link jumps to the support section

**Description:** Add a subtle "Support the project" anchor (`href="#support"`) to `LandingFooter`, next to the language switch / copyright. Smooth scrolling follows the existing page behaviour.

**Acceptance criteria:**
- [x] The footer shows a small link (`landing.footer.supportLink`, en + el) that scrolls to `#support`, and the section heading is not hidden under the sticky header (add `scroll-mt-*` on the section if needed).
- [x] The footer layout still wraps cleanly at 375px.

**Verification:**
- [x] `npx tsx scripts/check-i18n.ts` passes
- [x] Manual (browser): click the footer link. The page scrolls to the section with the heading fully visible below the sticky header, on mobile and desktop.

**Dependencies:** Task 1

**Files likely touched:**
- `src/components/landing/sections/landing-footer.tsx`
- `src/components/landing/sections/support.tsx` (`scroll-mt` only)
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/el.ts`

**Estimated scope:** Small

---

### Checkpoint: Landing
- [x] `pnpm run lint`, `npx tsx scripts/check-i18n.ts`, `npx tsx scripts/test-i18n-check.ts` pass
- [x] Browser check done: en/el × light/dark × 375px/1280px
- [x] Planner review passed (no human stop; plan already approved)

---

## Phase 2: Logged-in surfaces (parallel)

### Task 3: Logged-in user sees a subtle support strip at the bottom of the dashboard

**Description:** Add `SupportStrip`, a single low-contrast row (muted text + the two links in the `subtle` variant: zinc text, thin border, no filled colour, no shadow). Render it as the last child of the real `Dashboard` in `src/app/page.tsx`, after `<CategoryBreakdown />`. It is not rendered in the loading state or the "no wallet" welcome state.

**Acceptance criteria:**
- [x] On `/` with a loaded wallet, the strip is the last element of the dashboard. It is visually quieter than every card above it (no colour fill, small text), and its links open the correct URLs in a new tab.
- [x] It is absent while `isLoading && !walletData` and when `!walletData`.
- [x] Text comes only from existing `support.*` keys (no dictionary edits). On mobile it wraps without overflow and is not hidden by the bottom nav bar.

**Verification:**
- [x] `npx tsx scripts/check-i18n.ts` and `pnpm run lint` pass
- [x] Manual (browser): Mock mode, wallet with data. Check the strip in en/el, light/dark, 375px/1280px. Switch to a user with no wallet: no strip.

**Dependencies:** Task 1 (shared buttons + `support` block)

**Files likely touched:**
- `src/components/support-strip.tsx` (new)
- `src/app/page.tsx`

**Estimated scope:** Small

---

### Task 4: Logged-in user sees a support card on the profile page

**Description:** Add `ProfileSupportCard` (`src/components/support/profile-support-card.tsx`), using the same card shell as the profile page's password card (`bg-white dark:bg-zinc-900 border … rounded-3xl p-6 sm:p-8 shadow-sm`, an H2 with an indigo icon, a muted subtitle). The icon is `HeartHandshake`, and the body shows `SupportLinkButtons variant="subtle"`. Render it in `src/app/profile/page.tsx` after the closing `</form>`, inside the page container.

**Acceptance criteria:**
- [x] `/profile` shows the card below the Save button, outside the `<form>`, in both Mock and Normal mode. Its links open the correct URLs in a new tab.
- [x] Text comes only from existing `support.*` keys (no dictionary edits). The card matches the other profile cards in light and dark mode and at 375px.

**Verification:**
- [x] `npx tsx scripts/check-i18n.ts` and `pnpm run lint` pass
- [x] Manual (browser): `/profile` in Mock mode, en/el, light/dark, 375px/1280px. Clicking a support link does not submit the form.

**Dependencies:** Task 1

**Files likely touched:**
- `src/components/support/profile-support-card.tsx` (new)
- `src/app/profile/page.tsx`

**Estimated scope:** Small

---

### Checkpoint: Logged-in surfaces
- [x] Strip correct in Mock mode with data, absent in empty/loading states
- [x] Profile card correct in both auth modes
- [x] Mobile bottom bar covers neither

---

## Phase 3: Docs + full verification

### Task 5: Document support links and run the full suite

**Description:** Add one short bullet to `AGENTS.md` (§3 public landing page / §6 layout) saying that the support URLs live in `src/lib/support-links.ts`, that the landing `#support` section, the dashboard `SupportStrip` and the profile `ProfileSupportCard` share `support-link-buttons.tsx`, and that the dashboard strip must stay subtle and not dismissible. Then run the repo's full verification list.

**Acceptance criteria:**
- [x] AGENTS.md points to the single URL source and the three surfaces
- [x] The full verification list passes with no new warnings

**Verification:**
- [x] `npx prisma validate`
- [x] `npx tsx scripts/test-e2e.ts`
- [x] `pnpm test`
- [x] `pnpm run build`

**Dependencies:** Tasks 1–4

**Files likely touched:**
- `AGENTS.md`

**Estimated scope:** XS

---

### Checkpoint: Complete
- [x] Every acceptance criterion above is checked
- [x] Final browser pass of all three surfaces
- [x] Ready for review
