# Todo: Invitation acceptance flow

Plan: `tasks/invite-flow-plan.md`. Verification commands (AGENTS.md §7): `npx prisma validate`, `pnpm test`, `pnpm run lint`, `pnpm run build`. API tests need `pnpm dev` running on :3000.

---

## Phase 1: Foundation

### Task 1: Close the anonymous name/email upsert on `POST /api/invite/[code]`
**Description:** Joining must require a real session (normal) or mock user (dev). Remove the `name`/`email` → `prisma.user.upsert` branch, so the user always comes from `getCurrentUser(req)`. In normal mode, call it with `allowMockFallback` honoured through the `x-auth-mode` header, which is how it already works. Remove the matching "custom profile" UI state and fields from the invite page, and their now-unused i18n keys (en + el).

**Acceptance criteria:**
- [x] POST with `{name, email}` and no session/`x-user-id` (header `x-auth-mode: normal`) → `401`, and no `User` row is created or renamed.
- [x] POST with a valid user still joins (`201/200`, `walletId` returned), and calling it again returns "already a member" with the same `walletId`.
- [x] Targeted invite with a non-matching user → `403`.

**Verification:**
- [x] New `scripts/test-invite-api.ts` (HTTP, pattern of `test-month-bonus.ts`) covers the 3 cases above and cleans up after itself. Added to `test:api` in `package.json`.
- [x] `pnpm run lint`, `npx tsx scripts/check-i18n.ts`

**Dependencies:** None
**Files:** `src/app/api/invite/[code]/route.ts`, `src/app/invite/[code]/page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`, `scripts/test-invite-api.ts`, `package.json`
**Scope:** M

### Task 2: `safeNextPath()` + `authHref()` helpers
**Description:** In `src/lib/navigation.ts` add `safeNextPath(raw: string | null | undefined): string`. It returns `raw` only if it is a same-origin relative path that is not an auth path, otherwise `/`. Also add `authHref(kind: 'login' | 'register', next: string, extra?: { email?: string }): string`, which builds the encoded URL.

**Acceptance criteria:**
- [x] `safeNextPath` rejects `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)`, `%2F%2Fevil.com`, `/login`, `/register?next=…`, `''`, `null` → `/`.
- [x] Accepts `/invite/JOIN-8899?join=1`, `/expenses`.
- [x] `authHref('register', '/invite/X?join=1', { email: 'a@b.c' })` round-trips through `URLSearchParams`.

**Verification:**
- [x] Cases added to `scripts/test-navigation.ts`. `npx tsx scripts/test-navigation.ts` passes.

**Dependencies:** None
**Files:** `src/lib/navigation.ts`, `scripts/test-navigation.ts`
**Scope:** S

## Checkpoint 1: after Tasks 1–2
- [x] `pnpm test` passes; `pnpm run test:api` passes after restarting a stale dev server (its Prisma client predated the calendar-token migration)
- [x] `pnpm run lint` clean

---

## Phase 2: The flow

### Task 3: Login & register honour `?next=` and `?email=`
**Description:** Read `next` (and `email` on register) from search params. On success, `router.push(safeNextPath(next))` instead of `/`. The "Register" and "Sign in" cross-links keep `next`. The AppContext guard (logged-in user on an auth path) also redirects to `safeNextPath(next)`, not `/`. Read the Next 16 docs in `node_modules/next/dist/docs/` on `useSearchParams` / Suspense first.

**Acceptance criteria:**
- [x] `/login?next=%2Fexpenses` → after login, lands on `/expenses`. Without `next` → `/` (unchanged).
- [x] `/register?next=…&email=a@b.c` pre-fills email. The link to login keeps `next`, and the link back does too.
- [x] `/login?next=https%3A%2F%2Fevil.com` → lands on `/`.

**Verification:**
- [x] `pnpm run build` (catches missing Suspense boundary), `pnpm run lint`
- [x] Manual in browser (normal mode): each case above

**Dependencies:** Task 2
**Files:** `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/context/AppContext.tsx`
**Scope:** M

### Task 4: Invite page, logged-out state
**Description:** When `authMode === 'normal'`, auth is resolved and `!currentUser`, replace the single "Join as Member" button with:
- primary **Create account & join** → `authHref('register', '/invite/<code>?join=1', { email: targetEmail })`
- secondary **I already have an account, sign in** → `authHref('login', …)`

Add a short hint ("You'll be added to <wallet> right after"). Don't show the "Authentication required" error or the locked-email banner while logged out. Instead show "This invite is for <email>". All copy goes in the `invites` dictionary block (en + formal el).

**Acceptance criteria:**
- [x] Logged out: no POST happens and no error box shows. Both CTAs are visible and link to the right `next`.
- [x] Targeted invite: the register link pre-fills the target email, and a note shows which email to use.
- [x] Invalid/expired code still shows the existing "unavailable" card.

**Verification:**
- [x] `npx tsx scripts/check-i18n.ts`, `pnpm run lint`
- [x] Manual: private window → `/invite/<code>`

**Dependencies:** Tasks 1, 2
**Files:** `src/app/invite/[code]/page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`
**Scope:** S

### Task 5: Auto-accept on return + wrong-account path
**Description:** On `/invite/<code>?join=1` with a resolved `currentUser` whose email matches (or the invite isn't targeted), POST automatically once (`useRef` guard) and show a "Joining <wallet>…" state. Then `refreshWallets()`, `setActiveWalletId(walletId)`, confetti + toast, and `router.replace('/')`. "Already a member" behaves the same way (no error).

If the email doesn't match, don't POST. Show the locked banner with "Signed in as X" and a **Use a different account** button → `logout({ next: '/invite/<code>?join=1' })`, which lands on `/login?next=…`. Extend `logout` in AppContext with an optional `{ next }`; the default behaviour stays the same.

Check that the AppContext `activeWalletId` effect doesn't reset the active wallet to the first wallet after refresh.

**Acceptance criteria:**
- [x] Fresh private window → invite → Create account → lands on `/` with the invited wallet active and the user as MEMBER (Wallet & Team page lists them).
- [x] Same with Sign in for an existing account that isn't a member.
- [x] Reloading `/invite/<code>?join=1` as an existing member → straight to the dashboard with that wallet active. No duplicate membership or activity log.
- [x] Targeted invite + wrong account → no POST. "Use a different account" → login → after login, the user is auto-joined.

**Verification:**
- [x] `pnpm run lint`, `pnpm run build`
- [x] Manual browser run of all 4 scenarios (normal mode, private window). Screenshot each end state.

**Dependencies:** Tasks 3, 4
**Files:** `src/app/invite/[code]/page.tsx`, `src/context/AppContext.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`
**Scope:** M

## Checkpoint 2: after Tasks 3–5
- [x] `pnpm test`, `pnpm run test:api`, `pnpm run build` pass
- [x] Logged out → register → dashboard as member works end-to-end
- [x] Mock mode invite join still works (one click, no redirects)
- [x] Review with human before the chrome changes

---

## Phase 3: Chrome + docs

### Task 6: Public chrome for logged-out visitors on `/invite/*`
**Description:** Add `isPublicChromeView({ pathname, authMode, isAuthLoading, hasUser })` to `navigation.ts`. It is true in normal mode, on a public non-auth path, with auth resolved and no user. Extend `isSplashView` to cover public non-auth paths while auth is loading. In `AppShell`, render a new `src/components/public-header.tsx` instead of Sidebar + MonthContextBar: logo linking to `/`, EN/EL toggle, and a "Sign in" link with `next` set to the current path. Content sits in a centered `<main>`. Mobile: the same header, with no drawer and no bottom bar.

**Acceptance criteria:**
- [x] Logged out on `/invite/<code>` (desktop and mobile widths): no wallet selector, "+ Add", nav groups, month bar, "Guest User" footer or bottom bar.
- [x] No sidebar flash during auth loading (splash shows instead).
- [x] Logged-in and mock mode on `/invite/<code>`: the normal app chrome is unchanged.

**Verification:**
- [x] New view-matrix cases in `scripts/test-navigation.ts`
- [x] `pnpm run lint`, `pnpm run build`, `npx tsx scripts/check-i18n.ts`
- [x] Manual: private window at 1280px and 390px widths (light; dark not emulatable in the automation browser, `dark:` classes reviewed in code)

**Dependencies:** Task 2 (independent of 3–5; can run in parallel after Checkpoint 1)
**Files:** `src/lib/navigation.ts`, `src/components/app-shell.tsx`, `src/components/public-header.tsx`, `scripts/test-navigation.ts`, `src/lib/i18n/dictionaries/{en,el}.ts`
**Scope:** M

### Task 7: Docs + full verification
**Description:** Document the invite flow in AGENTS.md §3/§4: the `next` param plus `safeNextPath`, auto-accept with `?join=1`, joins requiring a session, and public chrome on `/invite/*` decided in AppShell. Run the full verification suite and the browser scenarios one last time.

**Acceptance criteria:**
- [x] AGENTS.md describes the flow and the rules (never redirect to an unvalidated `next`, chrome is decided only in AppShell).
- [x] All §7 checks pass.

**Verification:**
- [x] `npx prisma validate`, `pnpm test`, `pnpm run test:api`, `pnpm run lint`, `pnpm run build`

**Dependencies:** Tasks 1–6
**Files:** `AGENTS.md`
**Scope:** XS

## Checkpoint 3: invite flow complete
- [x] All acceptance criteria of Tasks 1–7 met
- [x] Invite-flow open questions resolved or deferred explicitly
- [x] Shippable on its own (Phases 4 and 5 can follow as separate deploys)

---

## Phase 4: Forgot password (email)
Design: see "Phase 4 design: forgot password" in the plan. Email setup comes from `~/Documents/softaware/softaware-apis` (`src/common/services/email.service.js`, `EMAIL_PROVIDER=gmail` with an app password). **Never print, log or commit secret values while copying them.**

### Task 8: Email service + env config
**Description:** Add `nodemailer` + `@types/nodemailer`. Port `email.service.js` to `src/lib/email.ts`:
- `sendEmail({ to, subject, text, html })`
- `isEmailDeliveryEnabled()`: defaults to true in production, false elsewhere, overridable with `EMAIL_DELIVERY_ENABLED`
- `assertEmailConfigured()`
- providers `smtp` and `gmail` (app password, or OAuth2)
- a cached transport

When delivery is off, write the email to the console instead of sending it. Add `getPublicBaseUrl()`: required in production, `http://localhost:3000` in dev.

Copy these variables from `softaware-apis/.env.production` into `budget-app/.env` (gitignored), file to file without echoing: `EMAIL_PROVIDER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM` (display name changed to "Aura Budget"), `EMAIL_REPLY_TO`. Add `EMAIL_DELIVERY_ENABLED=false` and `PUBLIC_BASE_URL=http://localhost:3000`. Add `scripts/send-test-email.ts <to>` for manual diagnosis. It sends one real email only when `EMAIL_DELIVERY_ENABLED=true` is passed explicitly.

**Acceptance criteria:**
- [x] The config check reports a clear error for each missing variable (gmail without user/password, smtp without host), as in softaware-apis.
- [x] With delivery off, `sendEmail` sends nothing over the network and logs the recipient and subject.
- [ ] `EMAIL_DELIVERY_ENABLED=true npx tsx scripts/send-test-email.ts eevangelinos@cognity.gr` delivers a real email (user confirms it arrived). **BLOCKED 2026-10-03: Gmail returned 535 BadCredentials for the copied app password (same value in softaware-apis .env and .env.production) — needs a new app password.**
- [x] `git status` shows no `.env` changes, and no secrets appear in any committed file.

**Verification:**
- [x] New `scripts/test-email.ts` (pure: provider selection, config validation, delivery-enabled default with an injected env). Added to `pnpm test`.
- [x] `pnpm run lint`, `pnpm run build` (builds without email env vars; config is resolved lazily)

**Dependencies:** None (can start after Checkpoint 3, or in parallel with Phase 3)
**Files:** `package.json`, `pnpm-lock.yaml`, `src/lib/email.ts`, `scripts/test-email.ts`, `scripts/send-test-email.ts`, `.env` (local only, not committed)
**Scope:** M

### Task 9: Request a reset link
**Description:** Add the `PasswordResetToken` model and `User.passwordChangedAt` in one additive migration (`--create-only`, check the SQL, then apply; never reset).

Add `POST /api/auth/password/forgot` with body `{ email, language, next? }`. It normalizes the email and applies the rate limits (3 per email per hour counted from DB rows, 10 per IP per hour in memory). If the user exists, it invalidates their older unused tokens, creates a token (stores only its SHA-256 hash, valid 30 min), and sends the email. The link is `${PUBLIC_BASE_URL}/reset-password?token=…&next=<safeNextPath(next)>`. It **always** returns `200 { ok: true }`. Send failures are logged on the server, not returned.

Add a `/forgot-password` page with an email field that confirms "If an account exists, we've sent a link", and a **Forgot password?** link on `/login` that keeps `next`. Add `/forgot-password` and `/reset-password` to `isAuthPath`. Email subject/body go in a new `email.passwordReset` dictionary block, and page copy in `auth` (en + formal el).

**Acceptance criteria:**
- [x] Known and unknown emails get identical responses. A token row exists only for the known one, with no raw token stored.
- [x] The 4th request for the same email within an hour sends nothing and still returns 200.
- [x] In dev, the server console shows the email with a working `http://localhost:3000/reset-password?token=…` link.

**Verification:**
- [x] New `scripts/test-password-reset.ts` (HTTP + Prisma): the cases above. Added to `test:api`. `scripts/test-navigation.ts`: the new auth paths.
- [x] `npx prisma validate`, `npx tsx scripts/check-i18n.ts`, `pnpm run lint`

**Dependencies:** Tasks 2, 8
**Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_password_reset/`, `src/app/api/auth/password/forgot/route.ts`, `src/app/forgot-password/page.tsx`, `src/app/login/page.tsx`, `src/lib/navigation.ts`, `src/lib/i18n/dictionaries/{en,el}.ts`, `scripts/test-password-reset.ts`
**Scope:** L → split the migration out first if it grows. The route + page are the core.

### Task 10: Set a new password from the link
**Description:** Add `POST /api/auth/password/reset` with body `{ token, password }`. It hashes the token and looks it up. It rejects a token that's missing, expired or already used with `400 "This reset link is invalid or has expired"`. It enforces the same password rule as register (at least 6 chars).

In one transaction it sets `passwordHash` (`hashPassword`), sets `passwordChangedAt = now`, marks the token used, and deletes the user's other tokens. Then it issues a fresh `aura_session` cookie (with `iat` after `passwordChangedAt`) and returns `{ user }`.

Session check: `verifySessionToken` callers (`getCurrentUser`, `getSessionUser`) reject tokens whose `iat` is before `passwordChangedAt`.

Add a `/reset-password` page with new password + confirm. On success: `setAuthMode('normal')`, `setCurrentUser`, `refreshWallets`, toast, then `router.push(safeNextPath(next))`. An invalid link shows a "request a new link" CTA. The AppContext auth-path redirect must not fire on `/reset-password`.

**Acceptance criteria:**
- [x] A valid link sets the new password and signs the user in. The old password fails and the new one works at `/login`.
- [x] Using the same link again → 400. An expired link → 400.
- [x] A session cookie issued before the reset (e.g. another browser) → that session is now treated as logged out.
- [x] **Invite flow:** private window → invite → Sign in & join → Forgot password → email link → new password → auto-joined on the dashboard.
- [x] A password-less user (created by the old upsert) can set a password this way and log in.

**Verification:**
- [x] Extend `scripts/test-password-reset.ts`. Create tokens directly through Prisma with the exported `hashResetToken` helper, then cover valid / reused / expired / short password / old session rejected.
- [x] `pnpm test`, `pnpm run build`, manual browser check of the invite case

**Dependencies:** Tasks 3, 5, 9
**Files:** `src/app/api/auth/password/reset/route.ts`, `src/app/reset-password/page.tsx`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/context/AppContext.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`
**Scope:** M

### Task 11: Production email config, docs and verification
**Description:** Add the email variables and `PUBLIC_BASE_URL=https://budget.lnf.gr` to the server's `shared/.env.production`. The values are copied from softaware-apis, file to file; the user runs or approves the step on the server. Make `deploy-release.sh` fail fast when `PUBLIC_BASE_URL` is missing, and when `EMAIL_PROVIDER`/`EMAIL_FROM` are missing or the provider's credentials are incomplete. Document the **names** only (no values) in the README env table and AGENTS.md §3 ("Password reset": hashed single-use tokens, 30 min, no enumeration, links only from `PUBLIC_BASE_URL`, `passwordChangedAt` signs out old sessions). Back up the production `budget.db` before the migration.

**Acceptance criteria:**
- [ ] On budget.lnf.gr, a forgot-password request to the user's real inbox arrives within a minute, the link opens `https://budget.lnf.gr/reset-password…`, and the reset works.
- [ ] Email arrives in both EN and EL depending on the UI language.
- [x] The deploy script refuses a release with incomplete email config.

**Verification:**
- [x] All AGENTS.md §7 checks: `npx prisma validate`, `pnpm test`, `pnpm run test:api`, `pnpm run lint`, `pnpm run build`
- [ ] Manual production check (user confirms receipt)

**Dependencies:** Tasks 8–10
**Files:** `deploy/deploy-release.sh`, `README.md`, `AGENTS.md` (+ server-side `shared/.env.production`, not in the repo)
**Scope:** S

## Checkpoint 4: password recovery works in production
- [ ] All acceptance criteria of Tasks 8–11 met
- [ ] No secrets in git (`git log -p | grep -i app_password` is empty)
- [ ] Review with human before starting passkeys

---

## Phase 5: Passkeys (WebAuthn)
Design: see "Phase 5 design: passkeys" in the plan. Manual ceremony checks use Chrome DevTools → More tools → WebAuthn → "Enable virtual authenticator environment" (ctap2, internal, resident keys + user verification on).

### Task 12: Passkey schema, WebAuthn config and challenge helpers
**Description:** Add `@simplewebauthn/server` and `@simplewebauthn/browser` with pnpm. Add the `Passkey` model and the `User.passkeys` relation. Create the migration with `npx prisma migrate dev --create-only --name add_passkeys`, check that the SQL is only `CREATE TABLE`/`CREATE INDEX`, then apply it with `migrate dev` (never `reset`).

Create `src/lib/webauthn.ts` with:
- `getRelyingParty()`: env-driven, throws in production if `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` are missing
- `createChallengeCookie({challenge, purpose, userId?})` / `readChallengeCookie(req, purpose)`: HMAC with the session secret, 5-min expiry, purpose-bound
- `clearChallengeCookie(res)`

**Acceptance criteria:**
- [x] `npx prisma validate` passes. The migration is additive and existing data is intact (row counts of User/Wallet unchanged before and after).
- [x] A challenge cookie is rejected when tampered with, expired, or read with the wrong purpose.
- [x] `next build` still works without the WebAuthn env vars (they are resolved lazily, like `getSessionSecret`).

**Verification:**
- [x] New `scripts/test-webauthn.ts` (pure: sign/verify/expiry/purpose). Added to `pnpm test`.
- [x] `npx prisma validate`, `pnpm run build`

**Dependencies:** Checkpoint 4 (needs a stable auth flow and `PUBLIC_BASE_URL`; technically only Tasks 2 and 8)
**Files:** `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma`, `prisma/migrations/<ts>_add_passkeys/`, `src/lib/webauthn.ts`, `scripts/test-webauthn.ts`
**Scope:** M

### Task 13: Add a passkey from the Profile page
**Description:** Add the `register/options` and `register/verify` routes, both requiring a real session (normal mode).
- Options: `excludeCredentials` set to the user's existing passkeys, `residentKey: 'required'`, `userVerification: 'preferred'`. Stores the challenge cookie (purpose `register`, `userId`).
- Verify: checks the response with `verifyRegistrationResponse` and creates the `Passkey` row. Its default name comes from the authenticator/user agent (e.g. "Chrome on macOS"), and the user can rename it later.

Add a `ProfilePasskeysCard` on `/profile` (normal mode only). It lists passkeys (name, created, last used) and has an **Add a passkey** button that uses `startRegistration` from `@simplewebauthn/browser`. Handle user cancel (`NotAllowedError`) quietly. If WebAuthn isn't supported, show a short note. All copy goes in a new `passkeys` dictionary block (en + formal el).

**Acceptance criteria:**
- [ ] With the virtual authenticator, Add a passkey creates exactly one row, and it shows in the list.
- [ ] Adding again with the same authenticator is refused by the browser (excludeCredentials) and shows a friendly message.
- [x] Without a session (or in mock mode), the routes return 401 and the card is hidden.

**Verification:**
- [x] `scripts/test-passkey-api.ts` (HTTP): 401 without a session. The options payload has `excludeCredentials` and RP ID `localhost`. Verify with a missing/forged challenge cookie → 400. Added to `test:api`.
- [x] `pnpm run lint`, `npx tsx scripts/check-i18n.ts`, manual browser check

**Dependencies:** Task 12
**Files:** `src/app/api/auth/passkey/register/{options,verify}/route.ts`, `src/app/api/auth/passkeys/route.ts` (GET list), `src/components/profile/profile-passkeys-card.tsx`, `src/app/profile/page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`, `scripts/test-passkey-api.ts`
**Scope:** L → keep the card minimal here; rename/delete live in Task 15

### Task 14: Sign in with a passkey
> Note: challenge cookies are additionally single-use server-side (`consumeChallenge`), so a replayed verify request is rejected with 400.
**Description:** Add the `login/options` route (no session needed, empty `allowCredentials` for discoverable credentials, purpose `login` cookie) and the `login/verify` route.
- Verify finds the passkey by `credentialId` and runs `verifyAuthenticationResponse`. On success it updates the counter and `lastUsedAt`, sets the `aura_session` cookie through the existing helpers, and returns `{ user }`. An unknown credential or failed verification returns 401 with a generic error.
- Login page: a **Sign in with a passkey** button above or below the form, plus conditional UI (`autocomplete="username webauthn"` + `startAuthentication({ useBrowserAutofill: true })` when supported). On success it runs the same post-login steps as the password login (`setAuthMode('normal')`, `setCurrentUser`, `refreshWallets`, `router.push(safeNextPath(next))`).

**Acceptance criteria:**
- [ ] Logged out → `/login` → Sign in with a passkey → lands on `/` (or on `next`) signed in as the passkey's owner.
- [ ] **Invite flow:** private window → `/invite/<code>` → Sign in & join → passkey → auto-joined and on the dashboard as a member.
- [x] The counter and `lastUsedAt` are updated. A replayed verify request (same challenge) → 400.
- [x] Password login is unchanged.

**Verification:**
- [x] Extend `scripts/test-passkey-api.ts`: login/verify without or with a stale challenge → 400, unknown credential → 401.
- [x] `pnpm run build`, manual check with the virtual authenticator (both cases above)

**Dependencies:** Tasks 3, 5, 13
**Files:** `src/app/api/auth/passkey/login/{options,verify}/route.ts`, `src/app/login/page.tsx`, `src/lib/i18n/dictionaries/{en,el}.ts`, `scripts/test-passkey-api.ts`
**Scope:** M

### Task 15: Manage passkeys and the setup prompt
**Description:** Add `PATCH /api/auth/passkeys/[id]` (rename, 1–50 chars) and `DELETE` (owner only, 404 for anyone else). Add rename (inline) and remove (confirm dialog) to `ProfilePasskeysCard`. Add a dismissible **"Sign in faster with a passkey"** card on the dashboard. It shows in normal mode when WebAuthn is supported, the user has 0 passkeys, and it hasn't been dismissed (`localStorage` `aura_passkey_prompt_dismissed:<userId>`). Its CTA runs the same add-passkey ceremony, or links to `/profile#passkeys`. New users, including invite signups, see it on first landing.

**Acceptance criteria:**
- [x] Rename and delete work. Another user's passkey ID → 404, and the row is untouched.
- [ ] A deleted passkey can no longer sign in (401).
- [x] The prompt shows for a new user with no passkeys, disappears once one is added or the prompt is dismissed, and never shows in mock mode.

**Verification:**
- [x] Extend `scripts/test-passkey-api.ts` with ownership cases (insert a fixture `Passkey` row directly through Prisma for user B and try PATCH/DELETE as user A).
- [ ] manual ceremony check; `pnpm run lint`, `npx tsx scripts/check-i18n.ts` pass; prompt checked at desktop width at desktop and mobile widths

**Dependencies:** Task 13 (and Task 14 for the "deleted passkey can't sign in" check)
**Files:** `src/app/api/auth/passkeys/[id]/route.ts`, `src/components/profile/profile-passkeys-card.tsx`, `src/components/passkey-setup-prompt.tsx`, `src/app/page.tsx` (dashboard), `src/lib/i18n/dictionaries/{en,el}.ts`
**Scope:** M

### Task 16: Production config, docs and verification
**Description:** Add `WEBAUTHN_RP_ID=budget.lnf.gr` and `WEBAUTHN_ORIGIN=https://budget.lnf.gr` to the production env docs (README table, `deploy-release.sh` header and env check). Add the dev defaults to `.env` if needed. Add a "Passkeys" note to AGENTS.md §3 covering the routes, the challenge cookie, discoverable credentials, mock mode hiding the UI, and that changing the domain invalidates passkeys. Before deploying, take a backup of the production `budget.db`.

**Acceptance criteria:**
- [x] `deploy-release.sh` fails fast on a non-https `WEBAUTHN_ORIGIN` or a mismatched `WEBAUTHN_RP_ID` (both optional; they default from `PUBLIC_BASE_URL`, which is required).
- [ ] On budget.lnf.gr, a real device (e.g. iCloud Keychain / Google Password Manager) can add a passkey and sign in with it, including through an invite link in a private window.
- [x] All AGENTS.md §7 checks pass.

**Verification:**
- [x] `npx prisma validate`, `pnpm test`, `pnpm run test:api`, `pnpm run lint`, `pnpm run build`
- [ ] Manual production smoke test after deploy (user confirms on a real device)

**Dependencies:** Tasks 12–15
**Files:** `README.md`, `deploy/deploy-release.sh`, `AGENTS.md`, `.env` (dev only)
**Scope:** S

## Checkpoint 5: Complete
- [ ] All acceptance criteria met (Tasks 1–16)
- [ ] Open questions in the plan resolved or deferred explicitly
- [ ] DB backed up, migration applied in production, passkeys verified on a real device
- [ ] Ready for review / deploy to budget.lnf.gr
