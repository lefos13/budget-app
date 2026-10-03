import type { LucideIcon } from 'lucide-react';
import { Layers, Bell, CreditCard, PiggyBank, Calendar, Repeat, Users } from 'lucide-react';

export type NavGroupId = 'month' | 'recurring' | 'manage';

export type NavGroupLabelKey = 'groupMonth' | 'groupRecurring' | 'groupManage';

export interface NavItem {
  href: string;
  labelKey:
    | 'overview'
    | 'alerts'
    | 'expenses'
    | 'savings'
    | 'calendar'
    | 'recurring'
    | 'walletTeam';
  icon: LucideIcon;
  monthScoped: boolean;
  mobileBar: boolean;
}

export interface NavGroup {
  id: NavGroupId;
  labelKey: NavGroupLabelKey;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'month',
    labelKey: 'groupMonth',
    items: [
      { href: '/', labelKey: 'overview', icon: Layers, monthScoped: true, mobileBar: true },
      { href: '/alerts', labelKey: 'alerts', icon: Bell, monthScoped: true, mobileBar: false },
      { href: '/expenses', labelKey: 'expenses', icon: CreditCard, monthScoped: true, mobileBar: true },
      { href: '/savings', labelKey: 'savings', icon: PiggyBank, monthScoped: true, mobileBar: true },
      { href: '/calendar', labelKey: 'calendar', icon: Calendar, monthScoped: true, mobileBar: true },
    ],
  },
  {
    id: 'recurring',
    labelKey: 'groupRecurring',
    items: [
      { href: '/recurring', labelKey: 'recurring', icon: Repeat, monthScoped: false, mobileBar: true },
    ],
  },
  {
    id: 'manage',
    labelKey: 'groupManage',
    items: [
      { href: '/wallet', labelKey: 'walletTeam', icon: Users, monthScoped: false, mobileBar: false },
    ],
  },
];

const MONTH_SCOPED_HREFS = new Set<string>(
  NAV_GROUPS.flatMap((g) => g.items)
    .filter((i) => i.monthScoped)
    .map((i) => i.href)
);

export function isMonthScopedPath(pathname: string): boolean {
  if (!pathname) return false;
  return MONTH_SCOPED_HREFS.has(pathname);
}

export type AuthModeId = 'mock' | 'normal';

export function isAuthPath(pathname: string | null | undefined): boolean {
  return pathname === '/login' || pathname === '/register';
}

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return isAuthPath(pathname) || pathname === '/invite' || pathname.startsWith('/invite/');
}

/** Pages a `next` redirect must never point back to (would loop through auth). */
const AUTH_FLOW_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

/**
 * Validates a post-auth redirect target. Only same-origin relative paths pass;
 * anything else (absolute URLs, `//host`, backslash tricks, auth pages) falls back to `/`.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  if (decoded.startsWith('//') || decoded.includes('\\')) return '/';
  const pathname = raw.split(/[?#]/)[0];
  if (AUTH_FLOW_PATHS.has(pathname)) return '/';
  return raw;
}

export type AuthPageKind = 'login' | 'register' | 'forgot-password';

/** Link to an auth page that returns to `next` afterwards (only kept when it is safe). */
export function authHref(
  kind: AuthPageKind,
  next?: string | null,
  extra?: { email?: string | null }
): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(next);
  if (safe !== '/') params.set('next', safe);
  if (extra?.email) params.set('email', extra.email);
  const query = params.toString();
  return query ? `/${kind}?${query}` : `/${kind}`;
}

export interface NavigationViewState {
  pathname: string | null | undefined;
  authMode: AuthModeId;
  isAuthLoading: boolean;
  hasUser: boolean;
}

/** Logged-out visitor on `/` in normal mode: public landing page, no app chrome. */
export function isLandingView({ pathname, authMode, isAuthLoading, hasUser }: NavigationViewState): boolean {
  return pathname === '/' && authMode === 'normal' && !isAuthLoading && !hasUser;
}

/** Normal mode on `/` or public non-auth paths while auth is still resolving: neutral splash, no chrome. */
export function isSplashView({ pathname, authMode, isAuthLoading }: Omit<NavigationViewState, 'hasUser'>): boolean {
  if (authMode !== 'normal' || !isAuthLoading) return false;
  return pathname === '/' || (isPublicPath(pathname) && !isAuthPath(pathname));
}

/** Logged-out visitor on a public non-auth path (e.g. `/invite/*`) in normal mode: minimal public header, no app chrome. */
export function isPublicChromeView({ pathname, authMode, isAuthLoading, hasUser }: NavigationViewState): boolean {
  return (
    authMode === 'normal' &&
    !isAuthLoading &&
    !hasUser &&
    isPublicPath(pathname) &&
    !isAuthPath(pathname)
  );
}
