import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

/**
 * The caller's private calendar feed token for this wallet.
 * GET returns it (creating one on first use); POST replaces it, so links shared earlier stop working.
 * Any member (including VIEWER) may hold one: the feed is read-only.
 */
async function issueToken(req: NextRequest, walletId: string, rotate: boolean) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.walletMember.findUnique({
    where: { walletId_userId: { walletId, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (membership.calendarToken && !rotate) {
    return NextResponse.json({ token: membership.calendarToken });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.walletMember.update({ where: { id: membership.id }, data: { calendarToken: token } });
  return NextResponse.json({ token });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return await issueToken(req, id, false);
  } catch (error) {
    console.error('Error loading calendar token:', error);
    return NextResponse.json({ error: 'Failed to load calendar link' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return await issueToken(req, id, true);
  } catch (error) {
    console.error('Error rotating calendar token:', error);
    return NextResponse.json({ error: 'Failed to reset calendar link' }, { status: 500 });
  }
}
