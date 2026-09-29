import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const invite = await prisma.walletInvite.findUnique({
      where: { code },
      include: {
        wallet: {
          include: {
            members: {
              include: { user: true },
            },
            _count: {
              select: { expenses: true, invoices: true },
            },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found or invalid' }, { status: 404 });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invitation link has expired' }, { status: 410 });
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return NextResponse.json({ error: 'This invitation has reached its usage limit' }, { status: 410 });
    }

    return NextResponse.json({
      invite: {
        code: invite.code,
        role: invite.role,
        targetEmail: invite.targetEmail,
        status: invite.status,
        createdAt: invite.createdAt,
      },
      wallet: {
        id: invite.wallet.id,
        name: invite.wallet.name,
        currency: invite.wallet.currency,
        color: invite.wallet.color,
        icon: invite.wallet.icon,
        memberCount: invite.wallet.members.length,
        members: invite.wallet.members.map((m) => ({
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching invite:', error);
    return NextResponse.json({ error: 'Failed to query invite' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, email } = body;

    const invite = await prisma.walletInvite.findUnique({
      where: { code },
      include: {
        wallet: {
          include: { members: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invitation code' }, { status: 404 });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invitation link has expired' }, { status: 410 });
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return NextResponse.json({ error: 'This invitation has reached its usage limit' }, { status: 410 });
    }

    // Determine user joining
    let user;
    if (email && name) {
      user = await prisma.user.upsert({
        where: { email: email.trim().toLowerCase() },
        update: { name: name.trim() },
        create: {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`,
        },
      });
    } else {
      user = await getCurrentUser(req);
    }

    if (!user) {
      return NextResponse.json({ error: 'Authentication required to accept invite' }, { status: 401 });
    }

    // Verify targeted invitation email
    if (invite.targetEmail) {
      if (!user.email || user.email.trim().toLowerCase() !== invite.targetEmail.trim().toLowerCase()) {
        return NextResponse.json(
          { error: `This invitation was sent specifically to ${invite.targetEmail}.` },
          { status: 403 }
        );
      }
    }

    // Check if already a member
    const existingMember = invite.wallet.members.find((m) => m.userId === user.id);
    if (existingMember) {
      return NextResponse.json({
        message: 'You are already a member of this wallet',
        walletId: invite.walletId,
        user,
      });
    }

    // Join wallet
    await prisma.walletMember.create({
      data: {
        walletId: invite.walletId,
        userId: user.id,
        role: invite.role,
      },
    });

    // Increment invite usage and mark as ACCEPTED
    await prisma.walletInvite.update({
      where: { id: invite.id },
      data: {
        usedCount: { increment: 1 },
        status: 'ACCEPTED',
      },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        walletId: invite.walletId,
        userId: user.id,
        action: 'MEMBER_JOINED',
        details: `${user.name} joined the wallet via invite code "${code}" as ${invite.role}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${invite.wallet.name}!`,
      walletId: invite.walletId,
      user,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
