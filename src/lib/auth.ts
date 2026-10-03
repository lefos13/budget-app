import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

import { NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'aura_session';
export const AUTH_COOKIE_NAME = SESSION_COOKIE_NAME;
const DEV_SESSION_SECRET = 'aura-budget-secret-key-2026';

/**
 * Resolved on first use, not at import, so `next build` can load this module without secrets.
 * Production refuses the public dev default: anyone could forge session tokens with it.
 */
function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production');
  }
  return DEV_SESSION_SECRET;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

/**
 * Hashes a plain password using Node crypto.scryptSync with a random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against the stored salt:hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Creates an HMAC-signed session token for a given user ID or payload.
 */
export function createSessionToken(
  userOrId: string | { userId: string; email?: string },
  maxAgeSeconds?: number
): string {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.userId;
  const email = typeof userOrId === 'object' ? userOrId.email : undefined;
  const payload = JSON.stringify({ userId, email, iat: Date.now(), maxAgeSeconds });
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

/**
 * Validates a session token and extracts the userId and email if signature is valid.
 */
export function verifySessionToken(token: string): { userId: string; email?: string } | null {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payloadBase64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (!payload.userId) return null;

    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Validates the session cookie and returns the authenticated User, or null if unauthenticated.
 */
export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifySessionToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    return user;
  } catch (err) {
    console.error('Error retrieving session user:', err);
    return null;
  }
}
