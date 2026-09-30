import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getCurrentUser } from './session';
import { round2, SavingsBucketInput } from './savings';
import { getCurrentMonthKey, getMonthKey, compareMonthKeys } from './month';

type Db = Prisma.TransactionClient | typeof prisma;

export const GENERAL_BUCKET_NAME = 'General savings';

/**
 * Authenticates the caller and loads a bucket they may change (OWNER/MEMBER of its wallet).
 * Returns `{ error }` with the ready response when not allowed.
 */
export async function loadBucketForWrite(req: NextRequest, bucketId: string) {
  const user = await getCurrentUser(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const bucket = await prisma.savingsBucket.findUnique({ where: { id: bucketId } });
  if (!bucket) return { error: NextResponse.json({ error: 'Savings bucket not found' }, { status: 404 }) };
  const membership = await prisma.walletMember.findUnique({
    where: { walletId_userId: { walletId: bucket.walletId, userId: user.id } },
  });
  if (!membership) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (membership.role === 'VIEWER') {
    return { error: NextResponse.json({ error: 'Viewers cannot manage savings' }, { status: 403 }) };
  }
  return { user, bucket };
}

/** Parses a positive money amount (number or numeric string), rounded to cents; null when invalid. */
export function parseAmount(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = round2(n);
  return rounded > 0 ? rounded : null;
}

/**
 * Parses an optional movement date. Absent → now. `YYYY-MM-DD` is read as local noon so the month is the
 * one the user picked. Dates in a future month or after today are rejected (null).
 */
export function parseMovementDate(raw: unknown, now: Date = new Date()): Date | null {
  if (raw === undefined || raw === null || raw === '') return now;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const [y, m, d] = raw.trim().split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (compareMonthKeys(getMonthKey(date), getCurrentMonthKey(now)) > 0) return null;
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (date.getTime() > endOfToday.getTime()) return null;
  // Today → keep the actual time so same-day ordering stays natural.
  return date.toDateString() === now.toDateString() ? now : date;
}

/** Where a closing bucket's leftover goes. Sub-bucket money never returns to the monthly budget directly. */
export type Disposition = { type: 'GENERAL' } | { type: 'BUCKET'; targetBucketId: string };

/** Thrown inside a transaction when a bucket must close but the caller gave no disposition for its leftover. */
export class DispositionRequiredError extends Error {
  constructor(
    public readonly bucketId: string,
    public readonly leftover: number
  ) {
    super('Disposition required');
  }
}

/** Thrown inside a transaction for request errors detected after validation (mapped to 4xx by routes). */
export class SavingsRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

/** Parses `body.disposition`. Returns undefined when absent, null when malformed. */
export function parseDisposition(raw: unknown): Disposition | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { type, targetBucketId } = raw as Record<string, unknown>;
  if (type === 'GENERAL') return { type: 'GENERAL' };
  if (type === 'BUCKET' && typeof targetBucketId === 'string' && targetBucketId) {
    return { type: 'BUCKET', targetBucketId };
  }
  return null;
}

export async function getOrCreateGeneralBucket(db: Db, walletId: string) {
  const existing = await db.savingsBucket.findFirst({
    where: { walletId, kind: 'GENERAL' },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;
  return db.savingsBucket.create({
    data: { walletId, kind: 'GENERAL', name: GENERAL_BUCKET_NAME, icon: 'Landmark', color: '#6366f1' },
  });
}

export async function getBucketBalance(db: Db, bucketId: string): Promise<number> {
  const agg = await db.savingsTransaction.aggregate({ where: { bucketId }, _sum: { amount: true } });
  return round2(agg._sum.amount ?? 0);
}

/** Moves money between two buckets of the same wallet as a paired, budget-neutral ledger entry. */
export async function transferBetweenBuckets(
  tx: Prisma.TransactionClient,
  args: { walletId: string; fromBucketId: string; toBucketId: string; amount: number; userId: string; note?: string }
) {
  const transferGroupId = randomUUID();
  const date = new Date();
  await tx.savingsTransaction.createMany({
    data: [
      {
        walletId: args.walletId,
        bucketId: args.fromBucketId,
        userId: args.userId,
        type: 'TRANSFER_OUT',
        amount: -round2(args.amount),
        date,
        transferGroupId,
        note: args.note ?? null,
      },
      {
        walletId: args.walletId,
        bucketId: args.toBucketId,
        userId: args.userId,
        type: 'TRANSFER_IN',
        amount: round2(args.amount),
        date,
        transferGroupId,
        note: args.note ?? null,
      },
    ],
  });
}

/**
 * Enforces "a sub-bucket exists only while it has ≥1 PENDING linked planned expense".
 * Call after any change that may have removed a bucket's last pending expense, inside the same transaction.
 * Zero balance → closes silently. Leftover → requires a disposition (other active sub-bucket or General).
 */
export async function closeBucketIfEmpty(
  tx: Prisma.TransactionClient,
  bucketId: string,
  user: { id: string; name: string },
  disposition: Disposition | undefined
): Promise<{ closed: boolean; movedTo?: string; leftover: number }> {
  const bucket = await tx.savingsBucket.findUnique({ where: { id: bucketId } });
  if (!bucket || bucket.kind === 'GENERAL' || bucket.status !== 'ACTIVE') {
    return { closed: false, leftover: 0 };
  }
  const pendingCount = await tx.plannedExpense.count({
    where: { savingsBucketId: bucketId, status: 'PENDING' },
  });
  if (pendingCount > 0) return { closed: false, leftover: 0 };

  const leftover = await getBucketBalance(tx, bucketId);
  let movedTo: string | undefined;
  if (leftover > 0) {
    if (!disposition) throw new DispositionRequiredError(bucketId, leftover);
    let targetId: string;
    if (disposition.type === 'GENERAL') {
      targetId = (await getOrCreateGeneralBucket(tx, bucket.walletId)).id;
    } else {
      const target = await tx.savingsBucket.findUnique({ where: { id: disposition.targetBucketId } });
      if (
        !target ||
        target.id === bucket.id ||
        target.walletId !== bucket.walletId ||
        target.kind !== 'GOAL' ||
        target.status !== 'ACTIVE'
      ) {
        throw new SavingsRequestError('Invalid target savings bucket', 400);
      }
      targetId = target.id;
    }
    await transferBetweenBuckets(tx, {
      walletId: bucket.walletId,
      fromBucketId: bucket.id,
      toBucketId: targetId,
      amount: leftover,
      userId: user.id,
      note: 'Leftover from closed bucket',
    });
    movedTo = targetId;
  }

  await tx.savingsBucket.update({
    where: { id: bucketId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  await tx.activityLog.create({
    data: {
      walletId: bucket.walletId,
      userId: user.id,
      action: 'SAVINGS_BUCKET_CLOSED',
      details:
        leftover > 0
          ? `${user.name} closed savings bucket "${bucket.name}" and moved €${leftover.toFixed(2)} to ${
              disposition?.type === 'GENERAL' ? 'General savings' : 'another bucket'
            }`
          : `${user.name} closed savings bucket "${bucket.name}"`,
    },
  });
  return { closed: true, movedTo, leftover };
}

/**
 * Loads every bucket of a wallet (General, active and closed) with ledgers and pending linked expenses.
 * Closed buckets must stay in: their past deposits still count against the months they were made in.
 */
export async function loadSavingsInputs(db: Db, walletId: string) {
  const buckets = await db.savingsBucket.findMany({
    where: { walletId },
    include: {
      transactions: { select: { type: true, amount: true, date: true } },
      plannedExpenses: {
        where: { status: 'PENDING' },
        select: {
          id: true,
          title: true,
          amount: true,
          expectedDate: true,
          createdAt: true,
          categoryId: true,
          notes: true,
        },
        orderBy: [{ expectedDate: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const inputs: SavingsBucketInput[] = buckets.map((b) => ({
    id: b.id,
    kind: b.kind,
    ledger: b.transactions,
    pending: b.plannedExpenses,
  }));
  return { buckets, inputs };
}

/** Maps helper errors to JSON responses; returns null for unknown errors. */
export function savingsErrorResponse(error: unknown): { body: Record<string, unknown>; status: number } | null {
  if (error instanceof DispositionRequiredError) {
    return {
      body: { error: 'Disposition required', bucketId: error.bucketId, leftover: error.leftover },
      status: 409,
    };
  }
  if (error instanceof SavingsRequestError) {
    return { body: { error: error.message }, status: error.status };
  }
  return null;
}
