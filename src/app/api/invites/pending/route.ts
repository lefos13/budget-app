import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.email) {
      return NextResponse.json({ invites: [] });
    }

    const normalizedEmail = user.email.trim().toLowerCase();

    // Find invites targeted to this email that are PENDING and not expired
    const allTargeted = await prisma.walletInvite.findMany({
      where: {
        targetEmail: normalizedEmail,
        status: 'PENDING',
      },
      include: {
        wallet: {
          include: {
            members: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    // Filter out expired invites or wallets where user is already a member
    const activePending = allTargeted.filter((inv) => {
      if (inv.expiresAt && new Date(inv.expiresAt) < now) return false;
      if (inv.maxUses && inv.usedCount >= inv.maxUses) return false;
      const alreadyMember = inv.wallet.members.some((m) => m.userId === user.id);
      return !alreadyMember;
    });

    return NextResponse.json({
      invites: activePending.map((inv) => ({
        id: inv.id,
        code: inv.code,
        role: inv.role,
        targetEmail: inv.targetEmail,
        createdAt: inv.createdAt,
        wallet: {
          id: inv.wallet.id,
          name: inv.wallet.name,
          currency: inv.wallet.currency,
          color: inv.wallet.color,
          icon: inv.wallet.icon,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching pending targeted invites:', error);
    return NextResponse.json({ error: 'Failed to fetch pending invites' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { inviteId, code, action } = body;

    const invite = await prisma.walletInvite.findFirst({
      where: inviteId ? { id: inviteId } : { code },
      include: {
        wallet: {
          include: { members: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify targeted email
    if (invite.targetEmail) {
      if (!user.email || user.email.trim().toLowerCase() !== invite.targetEmail.trim().toLowerCase()) {
        return NextResponse.json(
          { error: `This invitation was sent specifically to ${invite.targetEmail}.` },
          { status: 403 }
        );
      }
    }

    if (action === 'DECLINE') {
      await prisma.walletInvite.update({
        where: { id: invite.id },
        data: { status: 'DECLINED' },
      });

      await prisma.activityLog.create({
        data: {
          walletId: invite.walletId,
          userId: user.id,
          action: 'INVITE_DECLINED',
          details: `${user.name} declined the invitation to join as ${invite.role}`,
        },
      });

      return NextResponse.json({ success: true, message: 'Invitation declined' });
    }

    if (action === 'ACCEPT') {
      const existingMember = invite.wallet.members.find((m) => m.userId === user.id);
      if (!existingMember) {
        await prisma.walletMember.create({
          data: {
            walletId: invite.walletId,
            userId: user.id,
            role: invite.role,
          },
        });
      }

      await prisma.walletInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          usedCount: { increment: 1 },
        },
      });

      await prisma.activityLog.create({
        data: {
          walletId: invite.walletId,
          userId: user.id,
          action: 'MEMBER_JOINED',
          details: `${user.name} accepted targeted invitation to join as ${invite.role}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully joined ${invite.wallet.name}!`,
        walletId: invite.walletId,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error handling pending invite action:', error);
    return NextResponse.json({ error: 'Failed to process invitation action' }, { status: 500 });
  }
}
