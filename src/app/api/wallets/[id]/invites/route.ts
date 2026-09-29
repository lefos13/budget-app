import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invites = await prisma.walletInvite.findMany({
      where: { walletId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { role = 'MEMBER', maxUses = 10, targetEmail } = body;

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = wallet.members.find((m) => m.userId === user.id);
    if (!membership || membership.role === 'VIEWER') {
      return NextResponse.json({ error: 'Unauthorized to create invites' }, { status: 403 });
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const cleanPrefix = wallet.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'JOIN';
    const code = `${cleanPrefix}-${randomSuffix}`;

    const normalizedTargetEmail =
      targetEmail && typeof targetEmail === 'string' && targetEmail.trim().length > 0
        ? targetEmail.trim().toLowerCase()
        : null;

    const invite = await prisma.walletInvite.create({
      data: {
        walletId: id,
        code,
        role: role === 'VIEWER' ? 'VIEWER' : 'MEMBER',
        targetEmail: normalizedTargetEmail,
        status: 'PENDING',
        maxUses: normalizedTargetEmail ? 1 : maxUses ? parseInt(maxUses) : null,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId: id,
        userId: user.id,
        action: 'INVITE_CREATED',
        details: normalizedTargetEmail
          ? `Created targeted ${role} invite for ${normalizedTargetEmail} ("${code}")`
          : `Created new ${role} invite code "${code}"`,
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}
