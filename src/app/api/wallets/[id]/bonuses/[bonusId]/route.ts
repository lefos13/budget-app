import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

/** Removes a bonus from its month's budget. OWNER only; the bonus must belong to this wallet. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bonusId: string }> }
) {
  try {
    const { id, bonusId } = await params;
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: id, userId: user.id } },
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the wallet owner can manage bonuses' }, { status: 403 });
    }

    const bonus = await prisma.monthBonus.findFirst({ where: { id: bonusId, walletId: id } });
    if (!bonus) return NextResponse.json({ error: 'Bonus not found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.monthBonus.delete({ where: { id: bonus.id } });
      await tx.activityLog.create({
        data: {
          walletId: id,
          userId: user.id,
          action: 'BONUS_REMOVED',
          details: `${user.name} removed €${bonus.amount.toFixed(2)} bonus budget from ${bonus.monthKey}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing month bonus:', error);
    return NextResponse.json({ error: 'Failed to update bonuses' }, { status: 500 });
  }
}
