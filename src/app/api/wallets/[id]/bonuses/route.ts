import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { isValidMonthKey } from '@/lib/month';
import { parseAmount } from '@/lib/savings-server';

const LABEL_MAX = 80;

/**
 * Adds a bonus (outside money) to ONE month's budget. OWNER only; never touches `Wallet.monthlyBudget`.
 * Body: `{ amount, month: 'YYYY-MM', label? }`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: id, userId: user.id } },
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the wallet owner can manage bonuses' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const amount = parseAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: 'Amount must be a positive finite number' }, { status: 400 });
    }
    if (!isValidMonthKey(body.month)) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    }
    let label: string | null = null;
    if (body.label !== undefined && body.label !== null) {
      if (typeof body.label !== 'string' || body.label.trim().length > LABEL_MAX) {
        return NextResponse.json({ error: 'Label must be at most 80 characters' }, { status: 400 });
      }
      label = body.label.trim() || null;
    }

    const bonus = await prisma.$transaction(async (tx) => {
      const created = await tx.monthBonus.create({
        data: { walletId: id, userId: user.id, monthKey: body.month as string, amount, label },
      });
      await tx.activityLog.create({
        data: {
          walletId: id,
          userId: user.id,
          action: 'BONUS_ADDED',
          details: `${user.name} added €${amount.toFixed(2)} bonus budget to ${created.monthKey}${label ? ` (${label})` : ''}`,
        },
      });
      return created;
    });

    return NextResponse.json({ bonus }, { status: 201 });
  } catch (error) {
    console.error('Error adding month bonus:', error);
    return NextResponse.json({ error: 'Failed to update bonuses' }, { status: 500 });
  }
}
