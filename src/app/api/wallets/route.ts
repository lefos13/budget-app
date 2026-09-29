import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await prisma.walletMember.findMany({
      where: { userId: user.id },
      include: {
        wallet: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
            categories: true,
            _count: {
              select: {
                expenses: true,
                invoices: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const wallets = memberships.map((m) => ({
      ...m.wallet,
      userRole: m.role,
    }));

    // Find targeted pending invitations for this user's email
    let pendingInvites: unknown[] = [];
    if (user.email) {
      pendingInvites = await prisma.walletInvite.findMany({
        where: {
          targetEmail: user.email.toLowerCase(),
          status: 'PENDING',
        },
        include: {
          wallet: {
            include: {
              members: {
                include: { user: true },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({ wallets, currentUser: user, pendingInvites });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, currency = 'EUR', monthlyBudget = 2000, color = '#6366f1', icon = 'Wallet' } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Wallet name is required' }, { status: 400 });
    }

    const wallet = await prisma.wallet.create({
      data: {
        name: name.trim(),
        currency,
        monthlyBudget: parseFloat(monthlyBudget) || 2000,
        color,
        icon,
        members: {
          create: [{ userId: user.id, role: 'OWNER' }],
        },
        categories: {
          create: [
            { name: 'General', icon: 'Tag', color: '#6366f1', monthlyLimit: monthlyBudget * 0.25 },
            { name: 'Utilities', icon: 'Zap', color: '#f59e0b', monthlyLimit: monthlyBudget * 0.2 },
            { name: 'Groceries', icon: 'ShoppingCart', color: '#10b981', monthlyLimit: monthlyBudget * 0.35 },
            { name: 'Entertainment', icon: 'Film', color: '#ec4899', monthlyLimit: monthlyBudget * 0.2 },
          ],
        },
        invites: {
          create: [
            {
              code: `${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role: 'MEMBER',
            },
          ],
        },
      },
      include: {
        members: true,
        categories: true,
        invites: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId: wallet.id,
        userId: user.id,
        action: 'WALLET_CREATED',
        details: `Created new wallet "${wallet.name}"`,
      },
    });

    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error) {
    console.error('Error creating wallet:', error);
    return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
  }
}
