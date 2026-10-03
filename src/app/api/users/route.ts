import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Dev user-switcher endpoint: lists every user and upserts users by email without auth.
// Mock auth is off in production (src/lib/session.ts), so the endpoint is too.
const MOCK_USERS_ENABLED = process.env.NODE_ENV !== 'production';

export async function GET() {
  if (!MOCK_USERS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!MOCK_USERS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email: email.trim().toLowerCase() },
      update: { name: name.trim() },
      create: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
