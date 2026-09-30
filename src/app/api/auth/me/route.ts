import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { verifyPassword, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // allowMockFallback = false so unauthenticated requests return null instead of Alex
    const user = await getCurrentUser(req, false);

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req, false);

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { name, avatarUrl, currentPassword, newPassword } = body;

    const updateData: {
      name?: string;
      avatarUrl?: string | null;
      passwordHash?: string;
    } = {};

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      if (name.trim().length > 80) {
        return NextResponse.json({ error: 'Name must not exceed 80 characters' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    // Validate avatarUrl if provided
    if (avatarUrl !== undefined) {
      if (avatarUrl === null || (typeof avatarUrl === 'string' && avatarUrl.trim() === '')) {
        updateData.avatarUrl = null;
      } else if (typeof avatarUrl === 'string') {
        const trimmedUrl = avatarUrl.trim();
        try {
          const parsed = new URL(trimmedUrl);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return NextResponse.json({ error: 'Avatar URL must be a valid http or https URL' }, { status: 400 });
          }
          updateData.avatarUrl = trimmedUrl;
        } catch {
          return NextResponse.json({ error: 'Avatar URL must be a valid URL' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
      }
    }

    // Password change: only if newPassword provided
    if (newPassword !== undefined && newPassword !== '') {
      if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length === 0) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, passwordHash: true },
      });

      if (!dbUser || !dbUser.passwordHash) {
        return NextResponse.json({ error: 'User does not have a password set' }, { status: 400 });
      }

      if (!verifyPassword(currentPassword, dbUser.passwordHash)) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      // Apply the same register password rule: Password must be at least 6 characters long
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
      }

      updateData.passwordHash = hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error in /api/auth/me PATCH:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

