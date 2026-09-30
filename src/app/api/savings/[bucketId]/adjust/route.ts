import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { round2 } from '@/lib/savings';
import { getBucketBalance, loadBucketForWrite, parseAmount, SavingsRequestError } from '@/lib/savings-server';

/**
 * Manual add / remove on General savings: money coming from or going to outside the app.
 * Body: `{ direction: 'IN' | 'OUT', amount, note? }`. Budget-neutral: touches no other bucket, no monthly
 * budget and no Expense. Removal can't take General below €0.
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
      return NextResponse.json({ error: 'Only General savings can be adjusted manually' }, { status: 400 });
    }
    const { direction, note } = body;
    if (direction !== 'IN' && direction !== 'OUT') {
      return NextResponse.json({ error: 'Direction must be IN or OUT' }, { status: 400 });
    }
    const amount = parseAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: 'Amount must be a positive finite number' }, { status: 400 });
    }
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.trim().length > 200)) {
      return NextResponse.json({ error: 'Note must be at most 200 characters' }, { status: 400 });
    }
    const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null;

    const transaction = await prisma.$transaction(async (tx) => {
      if (direction === 'OUT') {
        const balance = await getBucketBalance(tx, bucket.id);
        if (round2(balance - amount) < 0) {
          throw new SavingsRequestError('Not enough money in General savings', 400);
        }
      }
      const created = await tx.savingsTransaction.create({
        data: {
          walletId: bucket.walletId,
          bucketId: bucket.id,
          userId: user.id,
          type: direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          amount: direction === 'IN' ? amount : -amount,
          date: new Date(),
          note: trimmedNote,
        },
      });
      await tx.activityLog.create({
        data: {
          walletId: bucket.walletId,
          userId: user.id,
          action: 'SAVINGS_GENERAL_ADJUSTED',
          details: `${user.name} manually ${direction === 'IN' ? 'added' : 'removed'} €${amount.toFixed(2)} ${
            direction === 'IN' ? 'to' : 'from'
          } General savings${trimmedNote ? ` ("${trimmedNote}")` : ''}`,
        },
      });
      return created;
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    if (error instanceof SavingsRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error adjusting General savings:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}
