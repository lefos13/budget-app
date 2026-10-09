/*
 * Imported by next.config.ts, so it must stay dependency-free.
 * Mirrors SESSION_COOKIE_NAME in src/lib/auth.ts (asserted by scripts/test-seo.ts).
 */
export const LANDING_SESSION_COOKIE = 'aura_session';

/*
 * `/` is served by the static Greek landing for visitors without a session cookie. Production
 * only: production always uses real auth, while dev can switch to mock mode in localStorage
 * (invisible to the server), so in dev `/` stays the app and its client-side landing fallback.
 */
export function shouldRewriteRootToLanding(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === 'production';
}
