import crypto from 'node:crypto';
import { getPublicBaseUrl } from './email';
import { safeNextPath } from './navigation';
import { en } from './i18n/dictionaries/en';
import { el } from './i18n/dictionaries/el';
import { interpolate } from './i18n/translator';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const RESET_EMAIL_PER_HOUR = 3;

const IP_LIMIT_MAX = 10;
const IP_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 rolling hour
const ipRequests = new Map<string, number[]>();

/**
 * Resets the in-memory IP rate limiter map (for test isolation).
 */
export function resetIpRateLimits(): void {
  ipRequests.clear();
}

/**
 * Checks in-memory per-IP rate limit: at most 10 requests per rolling hour.
 * Returns true if allowed (and records the hit), false if limit exceeded.
 */
export function checkIpRateLimit(ip: string, now: number = Date.now()): boolean {
  const normalizedIp = ip?.trim() || 'unknown';
  const windowStart = now - IP_LIMIT_WINDOW_MS;

  // Prune dead entries when map grows
  if (ipRequests.size > 500) {
    for (const [key, timestamps] of ipRequests.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        ipRequests.delete(key);
      } else {
        ipRequests.set(key, active);
      }
    }
  }

  const timestamps = ipRequests.get(normalizedIp) || [];
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= IP_LIMIT_MAX) {
    ipRequests.set(normalizedIp, activeTimestamps);
    return false;
  }

  activeTimestamps.push(now);
  ipRequests.set(normalizedIp, activeTimestamps);
  return true;
}

/**
 * Computes the SHA-256 hex digest of a password reset token.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a random 32-byte base64url token and its SHA-256 hash.
 */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}

/**
 * Builds the full reset password link using PUBLIC_BASE_URL.
 * Appends `&next=` only when safeNextPath(next) !== '/'.
 */
export function buildResetLink(token: string, next?: string | null): string {
  const baseUrl = getPublicBaseUrl();
  const params = new URLSearchParams();
  params.set('token', token);

  const safe = safeNextPath(next);
  if (safe !== '/') {
    params.set('next', safe);
  }

  return `${baseUrl}/reset-password?${params.toString()}`;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface ResetEmailContent {
  subject: string;
  text: string;
  html: string;
}

/**
 * Builds localized password reset email contents (subject, plain text, and HTML).
 */
export function buildResetEmail(
  language: 'en' | 'el',
  link: string,
  name: string
): ResetEmailContent {
  const dict = language === 'el' ? el : en;
  const copy = dict.email.passwordReset;
  const safeName = escapeHtml(name || '');

  const greetingText = interpolate(copy.greeting, { name: name || '' });
  const greetingHtml = interpolate(copy.greeting, { name: safeName });

  const text = `${greetingText}\n\n${copy.intro}\n\n${link}\n\n${copy.expiry}\n\n${copy.ignore}\n\n${copy.signoff}\n`;

  // i18n-ignore: HTML email template markup
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">${copy.subject}</h2>
    <p>${greetingHtml}</p>
    <p>${copy.intro}</p>
    <div style="margin: 28px 0;">
      <a href="${link}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">${copy.cta}</a>
    </div>
    <p style="font-size: 14px; color: #64748b;">${copy.expiry} ${copy.fallback}</p>
    <p style="font-size: 13px; word-break: break-all; color: #4f46e5;"><a href="${link}" style="color: #4f46e5;">${link}</a></p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">${copy.ignore}</p>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 16px;">${copy.signoff}</p>
  </div>
</body>
</html>`;

  return { subject: copy.subject, text, html };
}
