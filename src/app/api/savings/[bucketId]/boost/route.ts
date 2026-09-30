import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { round2 } from '@/lib/savings';
import {
  getBucketBalance,
  loadBucketForWrite,
  parseAmount,
  parseMovementDate,
  SavingsRequestError,
} from '@/lib/savings-server';

/**
 * "Use as extra budget": takes money out of General savings and adds it to a month's budget.
 * Body: `{ amount, date? }` (YYYY-MM-DD attributes it to a past month). GENERAL only; never automatic.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ bucketId: string }> }) {
  try {
    const { bucketId } = await params;
    const ctx = await loadBucketForWrite(req, bucketId);
    if ('error' in ctx) return ctx.error;
    const { user, bucket } = ctx;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (bucket.kind !== 'GENERAL') {
      return NextResponse.json({ error: 'Only General savings can be used as extra budget' }, { status: 400 });
    }
    const amount = parseAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: 'Amount must be a positive finite number' }, { status: 400 });
    }
    const date = parseMovementDate(body.date);
    if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

    const transaction = await prisma.$transaction(async (tx) => {
      const balance = await getBucketBalance(tx, bucket.id);
      if (round2(balance - amount) < 0) {
        throw new SavingsRequestError('Not enough money in General savings', 400);
      }
      const created = await tx.savingsTransaction.create({
        data: {
          walletId: bucket.walletId,
          bucketId: bucket.id,
          userId: user.id,
          type: 'BUDGET_BOOST',
          amount: -amount,
          date,
        },
      });
      await tx.activityLog.create({
        data: {
          walletId: bucket.walletId,
          userId: user.id,
          action: 'SAVINGS_BUDGET_BOOST',
          details: `${user.name} used €${amount.toFixed(2)} from General savings as extra budget`,
        },
      });
      return created;
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    if (error instanceof SavingsRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error using General savings as extra budget:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}
