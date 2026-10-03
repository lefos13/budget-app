import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { AUTH_COOKIE_NAME, verifySessionToken, getSessionTokenFromCookies } from './auth';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Mock auth (the `x-user-id` header and the default-user fallback) lets any caller act as any
 * user. It exists only for the dev user switcher and MUST stay off in production builds.
 */
const MOCK_AUTH_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Retrieves the current user based on:
 * 1. Valid `aura_session` HTTP-only cookie (JWT session token).
 * 2. `x-user-id` header (used in Mock Dev mode or switcher).
 * 3. Fallback to default user (Alex) if in mock/dev mode.
 *
 * If normal mode is active and unauthenticated, returns null (or throws if required).
 */
export async function getCurrentUser(
  reqOrUserId?: NextRequest | string | null,
  allowMockFallback = true
): Promise<CurrentUser | null> {
  let userIdHeader: string | null = null;
  let sessionToken: string | null = null;
  let authMode: string | null = null;

  if (typeof reqOrUserId === 'string') {
    userIdHeader = reqOrUserId;
  } else if (reqOrUserId && 'headers' in reqOrUserId) {
    const req = reqOrUserId as NextRequest;
    userIdHeader = req.headers.get('x-user-id');
    authMode = req.headers.get('x-auth-mode') || req.cookies.get('aura_auth_mode')?.value || null;
    sessionToken = req.cookies.get(AUTH_COOKIE_NAME)?.value || null;
  }

  // 1. If session token cookie is found, verify it first
  if (!sessionToken) {
    sessionToken = await getSessionTokenFromCookies();
  }

  if (sessionToken) {
    const payload = verifySessionToken(sessionToken);
    if (payload?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        };
      }
    }
  }

  // 2. If x-user-id header is provided (Mock mode or user switching; dev only)
  if (userIdHeader && MOCK_AUTH_ENABLED) {
    const user = await prisma.user.findUnique({
      where: { id: userIdHeader },
    });
    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      };
    }
  }

  // If in strict normal mode, in production, or not authenticated, do not fallback to mock user
  if (authMode === 'normal' || !allowMockFallback || !MOCK_AUTH_ENABLED) {
    return null;
  }

  // 3. Fallback to the first user (Alex Johnson) in mock dev mode
  const defaultUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (defaultUser) {
    return {
      id: defaultUser.id,
      name: defaultUser.name,
      email: defaultUser.email,
      avatarUrl: defaultUser.avatarUrl,
    };
  }

  // Create Alex if DB is totally empty
  const alex = await prisma.user.create({
    data: {
      email: 'alex@example.com',
      name: 'Alex Johnson',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  return {
    id: alex.id,
    name: alex.name,
    email: alex.email,
    avatarUrl: alex.avatarUrl,
  };
}
