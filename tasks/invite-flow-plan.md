# Implementation Plan: Invitation acceptance flow (logged-out → auth → dashboard as member)

Status: **IN PROGRESS** (2026-10-03). All open questions resolved with the recommended option (user: "go with your recommendations"). Implemented by Gemini subagents (Paseo profile "AGY - subagent"), orchestrated and reviewed by the planner, on branch `feat/invite-flow-auth`. There's no SPEC.md. The spec is the user's request (production screenshot of `/invite/JOIN-8899` in an incognito window) plus `AGENTS.md`.
Task checklist: `tasks/invite-flow-todo.md`. (The finished support-links plan is still in `tasks/plan.md` / `tasks/todo.md` and should be archived.)

## Overview
A logged-out visitor who opens `/invite/<code>` in production currently sees:
1. the full app chrome: sidebar with "Select Wallet", "+ Add", month-scoped nav, and a "Guest User" footer, and
2. a "Join as Member" button that only fails with `Authentication required to accept invite`.

Target behaviour:
- Logged out: the invite card shows inside a **minimal public chrome** (logo, language toggle, Sign in). It has **no** wallet selector, nav or user footer. The main actions are **Create account & join** and **Sign in & join**.
- Either auth path brings the user back to the invite, **accepts it automatically**, sets the joined wallet as active, and lands on `/` (dashboard) as a member.
- Logged in: one click joins as before. If the account's email doesn't match a targeted invite, the user sees a clear "signed in as X, switch account" path.

## Current state (what the code does today)
- `src/app/invite/[code]/page.tsx`: calls `POST /api/invite/<code>` and shows the 401 as an inline error. It never sends the user to `/login` or `/register`. It also has a "custom profile" (name + email) option.
- `src/app/api/invite/[code]/route.ts` POST: when `name`+`email` are sent it **upserts a User with no authentication**. In production, anyone can create password-less users, rename any existing user by email, and add that user to a wallet. **This is a security hole** and must be closed as part of this work.
- `src/app/login/page.tsx` and `src/app/register/page.tsx`: always `router.push('/')`. They have no `next` support.
- `src/context/AppContext.tsx:425-434` route guard: `/invite/*` is public (OK). A logged-in user on an auth path is pushed to `/`, which would race with a `next` redirect.
- `src/components/app-shell.tsx`: removes the chrome only for the landing view and splash on `/`. On `/invite/*` the Sidebar renders even with `currentUser === null` (shown as "Guest User").
- `logout()` always goes to `/` in normal mode, so there's no way to "switch account and come back".
- `POST /api/auth/register` creates a default "Personal Wallet" for every new user.

## Architecture Decisions
- **Return path is a `next` query param**, e.g. `/register?next=%2Finvite%2FJOIN-8899%3Fjoin%3D1`. It is validated by one pure helper, `safeNextPath()` in `src/lib/navigation.ts`. The helper only allows same-origin relative paths: it must start with a single `/`, must not start with `//` or `/\`, and must not be an auth path. Anything else falls back to `/`. This prevents an open redirect. No cookies and no server state are needed, and it works in incognito.
- **Auto-accept on return**: the invite page treats `?join=1` together with a resolved `currentUser` as "the user already chose to join". It POSTs once (guarded by a ref), then `router.replace('/')`. The intent was captured by the click before auth, so a second click isn't needed.
- **Joining needs a real session.** Remove the unauthenticated name/email upsert from the API and the "custom profile" UI. Mock mode already covers multi-user testing through the user switcher.
- **Chrome decision stays in `AppShell`**, as AGENTS.md §6 requires. Add `isPublicChromeView()` next to `isLandingView`/`isSplashView`. It is true in normal mode, on a public non-auth path (`/invite/*`), with no user. A new small `PublicHeader` component replaces Sidebar + MonthContextBar there. While auth is still resolving on `/invite/*`, render the neutral splash, not the app chrome, so there's no flash of the sidebar.
- **Targeted invites**: the register link is pre-filled with `?email=<targetEmail>`. If the email doesn't match, "Use a different account" calls `logout({ next })` and lands on `/login?next=…`.
- **New users keep the default Personal Wallet.** The joined wallet is made active, so the user lands in it.

## Dependency graph
```
safeNextPath / authHref helpers (navigation.ts) ──┬── login/register honour ?next (+ AppContext guard)
                                                   │          │
API lockdown (remove anonymous upsert) ────────────┼── invite page: logged-out CTAs ── auto-accept on return
                                                   │                                    (needs logout({next}))
isPublicChromeView (navigation.ts) ── AppShell + PublicHeader (independent of the flow tasks)
```

## Task List
See `tasks/invite-flow-todo.md` for full acceptance criteria.

### Phase 1: Foundation (security + helpers)
- [x] Task 1: Close the anonymous name/email upsert on `POST /api/invite/[code]`
- [x] Task 2: `safeNextPath()` + `authHref()` helpers with tests

### Checkpoint 1

### Phase 2: The flow
- [x] Task 3: Login & register honour `?next=` (and `?email=` prefill)
- [x] Task 4: Invite page logged-out state: "Create account & join" / "Sign in & join"
- [x] Task 5: Auto-accept on return + wrong-account path → dashboard as member

### Checkpoint 2: end-to-end flow works locally

### Phase 3: Chrome + docs
- [x] Task 6: Public chrome for logged-out visitors on `/invite/*` (no sidebar / wallet selector)
- [x] Task 7: AGENTS.md update + full browser verification

### Checkpoint 3: invite flow complete

### Phase 4: Forgot password (email)
- [x] Task 8: Email service (ported from softaware-apis) + env config
- [x] Task 9: Request a reset link (`/forgot-password` + email)
- [x] Task 10: Set a new password from the link (`/reset-password`) + sign out old sessions
- [ ] Task 11: Production email config, docs and real-inbox verification

### Checkpoint 4: password recovery works in production

### Phase 5: Passkeys (WebAuthn)
- [ ] Task 12: Passkey schema, WebAuthn config and challenge helpers
- [ ] Task 13: Add a passkey from the Profile page
- [ ] Task 14: Sign in with a passkey (honours `?next=`, so it works in the invite flow)
- [ ] Task 15: Manage passkeys (rename/delete) and the "set up a passkey" prompt after sign-up
- [ ] Task 16: Production config, docs and verification on budget.lnf.gr

### Checkpoint 5: complete

## Phase 4 design: forgot password
Source of the email setup: `~/Documents/softaware/softaware-apis`, file `src/common/services/email.service.js` (`nodemailer`). In production it runs with `EMAIL_PROVIDER=gmail` and a Gmail **app password**. We port that service and copy its env variable names and values. Secret values are copied file to file and never printed, committed or put in docs.

- **`src/lib/email.ts`**: a TypeScript port of `email.service.js`. Providers are `smtp` and `gmail` (app password, or OAuth2 as fallback). It creates one cached `nodemailer` transport, and `assertEmailConfigured()` gives a clear error when settings are missing. `EMAIL_DELIVERY_ENABLED` works as in softaware-apis: it defaults to **true in production and false elsewhere**. When delivery is off (dev/tests), the email, including the reset link, is written to the server console instead of being sent. New dependency: `nodemailer` (+ `@types/nodemailer`).
- **Env variables (same names as softaware-apis):** `EMAIL_PROVIDER`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_DELIVERY_ENABLED`. The optional `SMTP_HOST/PORT/SECURE/USER/PASS` and `GMAIL_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN/ACCESS_TOKEN` are supported but not set. Also new: `PUBLIC_BASE_URL` (`https://budget.lnf.gr` in prod, `http://localhost:3000` in dev). Links in emails are **always** built from it, never from the request's `Host` header, which an attacker could change to point reset links at their own site. Phase 5 can then default `WEBAUTHN_ORIGIN` to `PUBLIC_BASE_URL`.
  - Dev: the values go into `budget-app/.env` (already gitignored via `.env*`), with `EMAIL_DELIVERY_ENABLED=false` by default. Set it to true only to send a test email.
  - Prod: the values go into `shared/.env.production` on the server, next to `AUTH_SECRET`.
- **Token model (additive migration):** `PasswordResetToken { id, userId → User (cascade), tokenHash String @unique, expiresAt, usedAt DateTime?, createdAt }`. The raw token is 32 random bytes in base64url. Only its **SHA-256 hash** is stored, so a leaked database can't be used to reset passwords. Tokens last **30 minutes**, work **once**, and requesting a new one invalidates older unused ones.
- **Old sessions are signed out on reset:** sessions are stateless HMAC tokens that already carry `iat`. Add `User.passwordChangedAt DateTime?`. `getCurrentUser` / `getSessionUser` reject tokens with `iat < passwordChangedAt`. That's one additive column and no session table.
- **No account enumeration:** `POST /api/auth/password/forgot` always returns the same `200 { ok: true }` and roughly the same response time, whether or not the email exists.
- **Rate limits:** at most 3 requests per email per hour (counted from `PasswordResetToken` rows, so it survives restarts) and 10 per IP per hour (in memory; prod runs a single PM2 instance, `instances: 1`).
- **Works with the invite flow:** `/forgot-password?next=…` passes `next` into the emailed link (`/reset-password?token=…&next=…`). After the reset, the user is signed in and sent to `safeNextPath(next)`, so a user who forgot their password while accepting an invite still ends up joined on the dashboard.
- **Password-less users** created by the old invite upsert (open question 3) can use forgot-password to set a password. That claims the account safely through email ownership, which settles that question.
- **Email content** is bilingual. The forgot form sends the active language, and the subject/body come from the `email.passwordReset` dictionary keys (en + formal el), as plain text plus simple HTML.
- **Routes:** `/forgot-password` and `/reset-password` are public, chrome-less auth pages. Add them to `isAuthPath`. The "logged-in user on an auth page → redirect" rule must **not** fire on `/reset-password`, because a signed-in user may click a reset link.

## Phase 5 design: passkeys
Goal: a signed-in user (normal mode) can register one or more passkeys and then sign in with one tap (Face ID / Touch ID / Windows Hello / security key / phone). Passwords stay. A passkey is an **extra** sign-in method, not a replacement.

- **Library:** `@simplewebauthn/server` + `@simplewebauthn/browser`. These are the standard, maintained WebAuthn packages. Hand-rolling CBOR/COSE parsing and attestation checks is error-prone and security-critical. They are the only new dependencies.
- **Schema (additive, non-destructive):** a new `Passkey` model: `id`, `userId` → User (cascade), `credentialId String @unique` (base64url), `publicKey Bytes`, `counter Int`, `transports String?` (JSON), `deviceType String`, `backedUp Boolean`, `name String`, `createdAt`, `lastUsedAt DateTime?`. Plus a `passkeys Passkey[]` relation on `User`. Created with `prisma migrate dev --create-only` and reviewed: it must be `CREATE TABLE` / `CREATE INDEX` only. **Never reset the DB.**
- **Relying party:** `src/lib/webauthn.ts` reads `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` from the environment. In dev they default to `localhost` / `http://localhost:3000`. In production they are required, the same way `AUTH_SECRET` is (`budget.lnf.gr` / `https://budget.lnf.gr`). The RP name is "Aura Budget".
- **Challenges are stateless.** A short-lived (5 min) HTTP-only cookie `aura_webauthn` holds `{challenge, purpose: 'register'|'login', userId?, exp}`, signed with the existing session secret (HMAC, same scheme as `createSessionToken`). It is cleared after one verify attempt, so it can't be replayed. No new table is needed.
- **Discoverable credentials** (`residentKey: 'required'`, `userVerification: 'preferred'`). Sign-in is usernameless: one "Sign in with a passkey" button. The login email input also gets `autocomplete="username webauthn"`, so supporting browsers offer passkeys from the field (conditional UI).
- **Registration** needs an existing session. Existing credentials are passed as `excludeCredentials`, so the same authenticator can't be added twice.
- **Authentication** looks up the credential by `credentialId`, verifies the signature, checks the counter, then updates `counter` + `lastUsedAt`. It issues the normal `aura_session` cookie via `createSessionToken`, so everything after sign-in, including `next` and invite auto-join, works unchanged.
- **Scope rules:** passkeys are user-level, so wallet export/import (format 2.3) is not affected. Mock mode hides all passkey UI. Every API returns 401 without a real session. Delete/rename only work on the caller's own passkeys (404 otherwise, so other users' IDs aren't revealed).
- **Routes:** `POST /api/auth/passkey/register/options`, `POST /api/auth/passkey/register/verify`, `POST /api/auth/passkey/login/options`, `POST /api/auth/passkey/login/verify`, `GET /api/auth/passkeys`, `PATCH|DELETE /api/auth/passkeys/[id]`.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Open redirect via `next` | High | Allow only same-origin paths in `safeNextPath`, unit-tested with `//evil.com`, `/\evil.com`, `https://…`, `javascript:` and encoded variants |
| Race: AppContext guard pushes `/` before the login page pushes `next` | Med | Make the guard read `next` through `safeNextPath`, so both agree on the destination |
| Auto-accept fires twice (StrictMode / re-render) | Med | `useRef` guard, and the API is idempotent ("already a member" returns 200 + `walletId`) |
| Active wallet overwritten by the wallet-fetch effect after `refreshWallets()` picks the first wallet | Med | Check the `activeWalletId` effect in AppContext. Set the active wallet after refresh and verify in the browser |
| `useSearchParams` in Next 16 client pages needs a Suspense boundary for the build | Low | Read `node_modules/next/dist/docs/` before editing. Wrap in `<Suspense>` if the build complains |
| Removing the custom-profile option breaks someone's dev workflow | Low | The mock user switcher already covers it. Flagged as an open question |
| Users created earlier by the anonymous upsert have no `passwordHash`, so they can't log in, and register says "email already exists" | Low | Out of scope. Listed under open questions |

| Reset link host-header injection | High | Links built only from `PUBLIC_BASE_URL`, which is required in prod |
| Account enumeration via forgot-password | Med | Same response and roughly the same timing for known and unknown emails. Tested |
| Gmail daily send limit / app password revoked | Med | Low volume expected. Send failures are logged server-side and the user still sees the generic success message. `scripts/send-test-email.ts` for diagnosis |
| Sharing the softaware Gmail account: emails arrive from that sender | Low | `EMAIL_FROM` display name set to "Aura Budget". The address must stay the Gmail account or a verified alias (Gmail rewrites others). See open question 6 |
| Secrets leaking while copying the env | High | Copy values file to file. Never echo or commit them. `.env*` is already gitignored. Docs list only the names |
| Wrong RP ID / origin in prod → every passkey ceremony fails | High | Env vars required in prod (startup error like `AUTH_SECRET`). `deploy-release.sh` checks them. Verify on budget.lnf.gr in Task 16 |
| Changing the domain later orphans all passkeys (they're bound to the RP ID) | Med | Documented in README/AGENTS. Passwords remain as fallback |
| Challenge replay / cross-purpose use | High | Signed, 5-min, single-use cookie bound to the purpose (and to `userId` for registration). Unit-tested |
| Counter regression (cloned authenticator) | Low | The library flags it. Reject when `newCounter <= stored` (unless both are 0, which synced passkeys report) |
| Schema migration on production SQLite | Med | Additive migration only. `pnpm db:migrate` (deploy) already runs `migrate deploy`. Back up `budget.db` before deploying |
| WebAuthn can't be fully automated in the test scripts | Med | Unit-test the challenge cookie and ownership rules via HTTP. Run the ceremonies with Chrome DevTools' virtual authenticator (WebAuthn panel) |

## Open Questions
1. OK to **remove** the "join with a different name/email" custom-profile option entirely? It is the anonymous upsert. Recommended: yes.
2. Should invite-originated signups **skip** creating the default "Personal Wallet"? Recommended: keep it for now, but land on the joined wallet.
3. ~~Should password-less users created by the old upsert be able to claim their account?~~ Resolved by Phase 4: they can use forgot-password.
4. **Passkey-only sign-up** (create an account with no password)? Phase 4 adds email recovery, which makes it possible. Recommended: still not in this plan. Ship passkeys as an extra sign-in method first.
5. Where should the "set up a passkey" prompt appear after sign-up? Recommended: one dismissible card on the dashboard, shown once per user (dismissal stored in `localStorage`), plus the permanent section on Profile.
6. Should budget-app **reuse the softaware Gmail account** as its sender, or use its own address/alias? Recommended: reuse it for now with `EMAIL_FROM="Aura Budget <same gmail address>"` and a `EMAIL_REPLY_TO` you choose. A dedicated address can be swapped in later by changing only env values.
7. Add a "Change password" form on Profile (when signed in) too? Recommended: a small follow-up, not part of this plan.
