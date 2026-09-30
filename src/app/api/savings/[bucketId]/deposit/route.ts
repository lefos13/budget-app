import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadBucketForWrite, parseAmount, parseMovementDate } from '@/lib/savings-server';

/**
 * Saves money from the month's budget into a bucket (sub-bucket or General).
 * Body: `{ amount, date? }` — `date` (YYYY-MM-DD) attributes the deposit to a past month; never in the future.
 * Counts against that month's budget; it is not an Expense.
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

    const amount = parseAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: 'Amount must be a positive finite number' }, { status: 400 });
    }
    const date = parseMovementDate(body.date);
    if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

    if (bucket.kind !== 'GENERAL' && bucket.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This savings bucket is closed' }, { status: 409 });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.savingsTransaction.create({
        data: { walletId: bucket.walletId, bucketId: bucket.id, userId: user.id, type: 'DEPOSIT', amount, date },
      });
      await tx.activityLog.create({
        data: {
          walletId: bucket.walletId,
          userId: user.id,
          action: 'SAVINGS_DEPOSIT',
          details: `${user.name} saved €${amount.toFixed(2)} in "${bucket.kind === 'GENERAL' ? 'General savings' : bucket.name}"`,
        },
      });
      return created;
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error('Error depositing into savings:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}
