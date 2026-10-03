import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const passkeys = await prisma.passkey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        deviceType: true,
        backedUp: true,
      },
    });

    return NextResponse.json({ passkeys }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/auth/passkeys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch passkeys' },
      { status: 500 }
    );
  }
}
