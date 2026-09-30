import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { round2 } from '@/lib/savings';
import {
  getBucketBalance,
  loadBucketForWrite,
  parseAmount,
  SavingsRequestError,
  transferBetweenBuckets,
} from '@/lib/savings-server';

/**
 * Moves money from this bucket to General or another active sub-bucket of the same wallet.
 * Body: `{ toBucketId, amount }`. Budget-neutral. The only way money leaves a sub-bucket besides paying its
 * expense: there is deliberately no sub-bucket → monthly budget path.
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
    const { toBucketId } = body;
    if (typeof toBucketId !== 'string' || !toBucketId || toBucketId === bucket.id) {
      return NextResponse.json({ error: 'Invalid target savings bucket' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.savingsBucket.findUnique({ where: { id: toBucketId } });
      if (
        !target ||
        target.walletId !== bucket.walletId ||
        (target.kind !== 'GENERAL' && target.status !== 'ACTIVE')
      ) {
        throw new SavingsRequestError('Invalid target savings bucket', 400);
      }
      const balance = await getBucketBalance(tx, bucket.id);
      if (round2(balance - amount) < 0) {
        throw new SavingsRequestError('Not enough money in this savings bucket', 400);
      }
      await transferBetweenBuckets(tx, {
        walletId: bucket.walletId,
        fromBucketId: bucket.id,
        toBucketId: target.id,
        amount,
        userId: user.id,
      });
      const label = (b: { kind: string; name: string }) => (b.kind === 'GENERAL' ? 'General savings' : b.name);
      await tx.activityLog.create({
        data: {
          walletId: bucket.walletId,
          userId: user.id,
          action: 'SAVINGS_TRANSFER',
          details: `${user.name} moved €${amount.toFixed(2)} from "${label(bucket)}" to "${label(target)}"`,
        },
      });
      return { fromBucketId: bucket.id, toBucketId: target.id, amount };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SavingsRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error moving savings:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}
