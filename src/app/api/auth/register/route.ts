import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Hash password & create user
    const passwordHash = hashPassword(password);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        avatarUrl,
      },
    });

    // Create default personal wallet
    const wallet = await prisma.wallet.create({
      data: {
        name: 'Personal Wallet',
        currency: 'EUR',
        monthlyBudget: 2000.0,
        color: '#6366f1',
        icon: 'Wallet',
        members: {
          create: [{ userId: user.id, role: 'OWNER' }],
        },
        categories: {
          create: [
            { name: 'General', icon: 'Tag', color: '#6366f1', monthlyLimit: 500 },
            { name: 'Utilities', icon: 'Zap', color: '#f59e0b', monthlyLimit: 400 },
            { name: 'Groceries', icon: 'ShoppingCart', color: '#10b981', monthlyLimit: 700 },
            { name: 'Entertainment', icon: 'Film', color: '#ec4899', monthlyLimit: 400 },
          ],
        },
        invites: {
          create: [
            {
              code: `JOIN-${Math.floor(1000 + Math.random() * 9000)}`,
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

    // Issue session token
    const token = createSessionToken({ userId: user.id, email: user.email });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json(
      {
        user: safeUser,
        wallet,
      },
      { status: 201 }
    );

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to register user' }, { status: 500 });
  }
}
