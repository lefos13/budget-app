import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { hashResetToken } from '@/lib/password-reset';

const INVALID_RESET_LINK_ERROR = 'This reset link is invalid or has expired';
const PASSWORD_TOO_SHORT_ERROR = 'Password must be at least 6 characters long';
const FAILED_TO_RESET_ERROR = 'Failed to reset password';

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: INVALID_RESET_LINK_ERROR }, { status: 400 });
    }

    const { token, password } = (body as Record<string, unknown>) || {};

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: INVALID_RESET_LINK_ERROR }, { status: 400 });
    }

    const tokenHash = hashResetToken(token);
    const now = new Date();

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt <= now ||
      !resetToken.user
    ) {
      return NextResponse.json({ error: INVALID_RESET_LINK_ERROR }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: PASSWORD_TOO_SHORT_ERROR }, { status: 400 });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      // Guard against a race: conditional token update
      const tokenUpdate = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      if (tokenUpdate.count === 0) {
        return null;
      }

      const updatedUser = await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: hashPassword(password),
          passwordChangedAt: now,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      });

      return updatedUser;
    });

    if (!transactionResult) {
      return NextResponse.json({ error: INVALID_RESET_LINK_ERROR }, { status: 400 });
    }

    // Create session token after the transaction (iat >= passwordChangedAt)
    const sessionToken = createSessionToken({
      userId: transactionResult.id,
      email: transactionResult.email,
    });

    const safeUser = {
      id: transactionResult.id,
      name: transactionResult.name,
      email: transactionResult.email,
      avatarUrl: transactionResult.avatarUrl,
    };

    const response = NextResponse.json({ user: safeUser }, { status: 200 });
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error('Error in /api/auth/password/reset:', error);
    return NextResponse.json({ error: FAILED_TO_RESET_ERROR }, { status: 500 });
  }
}
