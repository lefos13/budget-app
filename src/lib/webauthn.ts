import crypto from 'node:crypto';
import type { NextResponse } from 'next/server';
import type { AuthenticatorTransport, WebAuthnCredential } from '@simplewebauthn/server';
import { getPublicBaseUrl, type EmailEnv } from './email';

export type { WebAuthnCredential, AuthenticatorTransport };
export type AuthenticatorTransportFuture = AuthenticatorTransport;

export type WebAuthnEnv = EmailEnv;

export interface RelyingParty {
  rpID: string;
  rpName: 'Aura Budget';
  origin: string;
}

export const WEBAUTHN_COOKIE_NAME = 'aura_webauthn';
export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type ChallengePurpose = 'register' | 'login';

export interface SignChallengeOptions {
  challenge: string;
  purpose: ChallengePurpose;
  userId?: string;
}

export interface VerifyChallengeResult {
  challenge: string;
  userId?: string;
}

export interface ChallengePayload {
  challenge: string;
  purpose: ChallengePurpose;
  userId?: string;
  exp: number;
}

export const WEBAUTHN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth/passkey',
  maxAge: 300,
};

// Duplicated from src/lib/auth.ts (DEV_SESSION_SECRET) so webauthn.ts does not edit auth.ts.
const DEV_SESSION_SECRET = 'aura-budget-secret-key-2026';

/**
 * Resolved on first use, not at import, so `next build` can load this module without secrets.
 * Production refuses the public dev default.
 */
function getAuthSecret(env: WebAuthnEnv = process.env): string {
  const secret = env.AUTH_SECRET || env.SESSION_SECRET;
  if (secret) return secret;
  if ((env.NODE_ENV || process.env.NODE_ENV) === 'production') {
    throw new Error('AUTH_SECRET must be set in production');
  }
  return DEV_SESSION_SECRET;
}

/**
 * Resolves the Relying Party configuration lazily from environment.
 * origin = WEBAUTHN_ORIGIN || getPublicBaseUrl(env) (trimmed)
 * rpID = WEBAUTHN_RP_ID || new URL(origin).hostname
 * Throws if origin is not https in production.
 */
export function getRelyingParty(env: WebAuthnEnv = process.env): RelyingParty {
  const isProd = (env.NODE_ENV || process.env.NODE_ENV) === 'production';
  const rawOrigin = env.WEBAUTHN_ORIGIN?.trim() || getPublicBaseUrl(env);
  const origin = rawOrigin.replace(/\/+$/, '');

  const url = new URL(origin);
  if (isProd && url.protocol !== 'https:') {
    throw new Error('WebAuthn origin must use HTTPS in production');
  }

  const rpID = env.WEBAUTHN_RP_ID?.trim() || url.hostname;

  return {
    rpID,
    // i18n-ignore: relying party name
    rpName: 'Aura Budget',
    origin,
  };
}

/**
 * Signs a WebAuthn challenge payload into a base64url(JSON) + '.' + HMAC-SHA256 token.
 */
export function signChallenge(
  { challenge, purpose, userId }: SignChallengeOptions,
  now = Date.now(),
  secret = getAuthSecret()
): string {
  const exp = now + CHALLENGE_TTL_MS;
  const payload: ChallengePayload = {
    challenge,
    purpose,
    ...(userId ? { userId } : {}),
    exp,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a challenge token against the expected purpose, checking signature, expiry, and format.
 */
export function verifyChallenge(
  value: string | undefined | null,
  purpose: ChallengePurpose,
  now = Date.now(),
  secret = getAuthSecret()
): VerifyChallengeResult | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parts = value.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, signature] = parts;
  if (!payloadBase64 || !signature) {
    return null;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadRaw = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadRaw) as Partial<ChallengePayload>;

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (typeof payload.challenge !== 'string' || !payload.challenge) {
      return null;
    }

    if (payload.purpose !== purpose) {
      return null;
    }

    if (typeof payload.exp !== 'number' || now > payload.exp) {
      return null;
    }

    return {
      challenge: payload.challenge,
      userId: typeof payload.userId === 'string' && payload.userId ? payload.userId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Sets the HTTP-only WebAuthn challenge cookie on a NextResponse.
 */
export function setChallengeCookie(res: NextResponse, value: string): void {
  res.cookies.set(WEBAUTHN_COOKIE_NAME, value, WEBAUTHN_COOKIE_OPTIONS);
}

/**
 * Clears the WebAuthn challenge cookie on a NextResponse.
 */
export function clearChallengeCookie(res: NextResponse): void {
  res.cookies.set(WEBAUTHN_COOKIE_NAME, '', {
    ...WEBAUTHN_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Reads and verifies the challenge cookie from an incoming request.
 */
export function readChallengeCookie(
  req: { cookies: { get(name: string): { value: string } | undefined } },
  purpose: ChallengePurpose,
  now = Date.now(),
  secret = getAuthSecret()
): VerifyChallengeResult | null {
  const value = req.cookies.get(WEBAUTHN_COOKIE_NAME)?.value;
  const result = verifyChallenge(value, purpose, now, secret);
  if (!result || !consumeChallenge(result.challenge, now)) return null;
  return result;
}

/**
 * Challenges already presented to a verify route. Clearing the cookie doesn't stop a captured
 * cookie + assertion pair being replayed, and synced passkeys report counter 0, so the server
 * remembers used challenges until they expire. In memory: production runs a single PM2 instance.
 */
const usedChallenges = new Map<string, number>();

export function consumeChallenge(challenge: string, now = Date.now()): boolean {
  for (const [key, expiresAt] of usedChallenges) {
    if (expiresAt <= now) usedChallenges.delete(key);
  }
  if (usedChallenges.has(challenge)) return false;
  usedChallenges.set(challenge, now + CHALLENGE_TTL_MS);
  return true;
}

/**
 * Converts a Uint8Array byte buffer to a base64url-encoded string.
 */
export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Converts a base64url-encoded string into a Uint8Array.
 */
export function fromBase64Url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64url'));
}

/**
 * Parses a JSON string containing transports into AuthenticatorTransport array.
 */
export function parseTransports(
  json: string | null | undefined
): AuthenticatorTransportFuture[] | undefined {
  if (!json || typeof json !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const validTransports = new Set<AuthenticatorTransportFuture>([
      'ble',
      'hybrid',
      'internal',
      'nfc',
      'usb',
    ]);

    const filtered = parsed.filter((item): item is AuthenticatorTransportFuture =>
      typeof item === 'string' && validTransports.has(item as AuthenticatorTransportFuture)
    );

    return filtered.length > 0 ? filtered : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Generates a human-friendly default passkey label based on User-Agent.
 */
export function defaultPasskeyName(userAgent: string | null | undefined): string {
  // i18n-ignore: stored default label
  const fallback = 'Passkey';
  if (!userAgent || typeof userAgent !== 'string') {
    return fallback;
  }

  const ua = userAgent;

  // OS detection
  let os: string | null = null;
  if (/iPhone/i.test(ua)) {
    os = 'iPhone';
  } else if (/iPad/i.test(ua)) {
    os = 'iPad';
  } else if (/iPod/i.test(ua)) {
    os = 'iPod';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Windows|Win64|WOW64|Win32/i.test(ua)) {
    os = 'Windows';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser detection (order matters)
  let browser: string | null = null;
  if (/Edg(?:e)?\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera\//i.test(ua)) {
    browser = 'Opera';
  } else if (/Firefox\/|FxiOS\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Chrome\/|CriOS\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) {
    browser = 'Safari';
  }

  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }

  return fallback;
}
