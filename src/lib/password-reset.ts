import crypto from 'node:crypto';
import { getPublicBaseUrl } from './email';
import { safeNextPath } from './navigation';

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
  const safeName = escapeHtml(name || '');

  if (language === 'el') {
    // i18n-ignore: email copy, moved to dictionaries in a follow-up
    const subject = 'Επαναφορά κωδικού πρόσβασης Aura Budget';
    // i18n-ignore: email copy, moved to dictionaries in a follow-up
    const text = `Γεια σας ${name},\n\nΛάβαμε ένα αίτημα για επαναφορά του κωδικού πρόσβασης για τον λογαριασμό σας στο Aura Budget.\n\nΜπορείτε να ορίσετε νέο κωδικό πατώντας στον παρακάτω σύνδεσμο:\n${link}\n\nΟ σύνδεσμος ισχύει για 30 λεπτά.\n\nΑν δεν ζητήσατε εσείς την επαναφορά κωδικού, μπορείτε να αγνοήσετε αυτό το μήνυμα. Ο τρέχων κωδικός σας παραμένει ασφαλής.\n`;
    // i18n-ignore: email copy, moved to dictionaries in a follow-up
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Επαναφορά κωδικού πρόσβασης</h2>
    <p>Γεια σας ${safeName},</p>
    <p>Λάβαμε ένα αίτημα για επαναφορά του κωδικού πρόσβασης για τον λογαριασμό σας στο Aura Budget.</p>
    <div style="margin: 28px 0;">
      <a href="${link}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">Επαναφορά κωδικού</a>
    </div>
    <p style="font-size: 14px; color: #64748b;">Ο σύνδεσμος ισχύει για 30 λεπτά. Αν το κουμπί δεν λειτουργεί, αντιγράψτε και επικολλήστε τον παρακάτω σύνδεσμο στον browser σας:</p>
    <p style="font-size: 13px; word-break: break-all; color: #4f46e5;"><a href="${link}" style="color: #4f46e5;">${link}</a></p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">Αν δεν ζητήσατε εσείς την επαναφορά κωδικού, μπορείτε να αγνοήσετε αυτό το μήνυμα. Ο τρέχων κωδικός σας παραμένει ασφαλής.</p>
  </div>
</body>
</html>`;

    return { subject, text, html };
  }

  // i18n-ignore: email copy, moved to dictionaries in a follow-up
  const subject = 'Reset your Aura Budget password';
  // i18n-ignore: email copy, moved to dictionaries in a follow-up
  const text = `Hello ${name},\n\nWe received a request to reset your password for your Aura Budget account.\n\nYou can reset your password using the link below:\n${link}\n\nThis link is valid for 30 minutes.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.\n`;
  // i18n-ignore: email copy, moved to dictionaries in a follow-up
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Reset your password</h2>
    <p>Hello ${safeName},</p>
    <p>We received a request to reset your password for your Aura Budget account.</p>
    <div style="margin: 28px 0;">
      <a href="${link}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    <p style="font-size: 14px; color: #64748b;">This link is valid for 30 minutes. If the button above does not work, copy and paste this link into your browser:</p>
    <p style="font-size: 13px; word-break: break-all; color: #4f46e5;"><a href="${link}" style="color: #4f46e5;">${link}</a></p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
