import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import {
  checkIpRateLimit,
  generateResetToken,
  hashResetToken,
  buildResetLink,
  buildResetEmail,
  RESET_EMAIL_PER_HOUR,
  RESET_TOKEN_TTL_MS,
} from '@/lib/password-reset';

export async function POST(req: NextRequest) {
  // Always respond with 200 { ok: true } to prevent account enumeration
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // nginx sets X-Real-IP to the socket address; the X-Forwarded-For fallback (last hop) is for setups without it.
  // The first X-Forwarded-For entry is client-controlled, so it is never trusted.
  const realIp = req.headers.get('x-real-ip')?.trim();
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = realIp || forwardedFor?.split(',').pop()?.trim() || 'unknown';

  if (!checkIpRateLimit(clientIp)) {
    return NextResponse.json({ ok: true });
  }

  const { email, language, next } = (body as Record<string, unknown>) || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail) {
    hashResetToken('dummy-token-to-flatten-timing');
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    hashResetToken('dummy-token-to-flatten-timing');
    return NextResponse.json({ ok: true });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTokensCount = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentTokensCount < RESET_EMAIL_PER_HOUR) {
    const { token, tokenHash } = generateResetToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const safeNext = typeof next === 'string' ? next : undefined;
    const link = buildResetLink(token, safeNext);
    const lang = language === 'el' ? 'el' : 'en';
    const emailContent = buildResetEmail(lang, link, user.name);

    // Not awaited: waiting for SMTP would make known emails measurably slower than unknown ones.
    void sendEmail({ to: user.email, ...emailContent }).catch((err) => {
      console.error('Failed to send password reset email:', err);
    });
  }

  return NextResponse.json({ ok: true });
}
