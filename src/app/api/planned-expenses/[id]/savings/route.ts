import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { canLinkToSavings } from '@/lib/savings';
import {
  closeBucketIfEmpty,
  parseDisposition,
  savingsErrorResponse,
  SavingsRequestError,
} from '@/lib/savings-server';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function loadContext(req: NextRequest, id: string) {
  const user = await getCurrentUser(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const plannedExpense = await prisma.plannedExpense.findUnique({ where: { id } });
  if (!plannedExpense) {
    return { error: NextResponse.json({ error: 'Planned expense not found' }, { status: 404 }) };
  }

  const membership = await prisma.walletMember.findUnique({
    where: { walletId_userId: { walletId: plannedExpense.walletId, userId: user.id } },
  });
  if (!membership) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (membership.role === 'VIEWER') {
    return { error: NextResponse.json({ error: 'Viewers cannot manage savings' }, { status: 403 }) };
  }
  return { user, plannedExpense };
}

/**
 * Links a PENDING future-month planned expense to a savings bucket.
 * Body: `{ bucketId }` (existing active sub-bucket) or `{ newBucket: { name, color?, icon? } }`.
 * Moving it away from another bucket that thereby loses its last pending expense requires `disposition`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadContext(req, id);
    if ('error' in ctx) return ctx.error;
    const { user, plannedExpense } = ctx;

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    if (plannedExpense.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending planned expenses can be linked to savings' },
        { status: 400 }
      );
    }
    if (!canLinkToSavings(plannedExpense.expectedDate)) {
      return NextResponse.json(
        { error: 'Only planned expenses in a future month can be linked to savings' },
        { status: 400 }
      );
    }

    const disposition = parseDisposition(body.disposition);
    if (disposition === null) return NextResponse.json({ error: 'Invalid disposition' }, { status: 400 });

    const { bucketId, newBucket } = body;
    let newBucketData: { name: string; color?: string; icon?: string } | null = null;
    if (newBucket !== undefined) {
      if (typeof newBucket !== 'object' || newBucket === null || Array.isArray(newBucket)) {
        return NextResponse.json({ error: 'Invalid savings bucket' }, { status: 400 });
      }
      const { name, color, icon } = newBucket as Record<string, unknown>;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
        return NextResponse.json(
          { error: 'Bucket name must be non-empty and at most 60 characters' },
          { status: 400 }
        );
      }
      if (color !== undefined && (typeof color !== 'string' || !HEX_COLOR.test(color))) {
        return NextResponse.json({ error: 'Invalid savings bucket' }, { status: 400 });
      }
      if (icon !== undefined && (typeof icon !== 'string' || !icon.trim() || icon.length > 40)) {
        return NextResponse.json({ error: 'Invalid savings bucket' }, { status: 400 });
      }
      newBucketData = { name: name.trim(), color, icon };
    } else if (typeof bucketId !== 'string' || !bucketId) {
      return NextResponse.json({ error: 'bucketId or newBucket is required' }, { status: 400 });
    }

    const previousBucketId = plannedExpense.savingsBucketId;
    if (!newBucketData && previousBucketId && previousBucketId === bucketId) {
      const bucket = await prisma.savingsBucket.findUnique({ where: { id: previousBucketId } });
      return NextResponse.json({ plannedExpense, bucket });
    }

    const result = await prisma.$transaction(async (tx) => {
      let bucket;
      if (newBucketData) {
        bucket = await tx.savingsBucket.create({
          data: {
            walletId: plannedExpense.walletId,
            kind: 'GOAL',
            name: newBucketData.name,
            ...(newBucketData.color ? { color: newBucketData.color } : {}),
            ...(newBucketData.icon ? { icon: newBucketData.icon } : {}),
          },
        });
        await tx.activityLog.create({
          data: {
            walletId: plannedExpense.walletId,
            userId: user.id,
            action: 'SAVINGS_BUCKET_CREATED',
            details: `${user.name} created savings bucket "${bucket.name}"`,
          },
        });
      } else {
        bucket = await tx.savingsBucket.findUnique({ where: { id: bucketId as string } });
        if (
          !bucket ||
          bucket.walletId !== plannedExpense.walletId ||
          bucket.kind !== 'GOAL' ||
          bucket.status !== 'ACTIVE'
        ) {
          throw new SavingsRequestError('Invalid savings bucket', 400);
        }
      }

      const updated = await tx.plannedExpense.update({
        where: { id: plannedExpense.id },
        data: { savingsBucketId: bucket.id },
      });
      await tx.activityLog.create({
        data: {
          walletId: plannedExpense.walletId,
          userId: user.id,
          action: 'PLANNED_EXPENSE_LINKED',
          details: `${user.name} is saving for "${plannedExpense.title}" in "${bucket.name}"`,
        },
      });

      if (previousBucketId) {
        await closeBucketIfEmpty(tx, previousBucketId, user, disposition);
      }
      return { plannedExpense: updated, bucket };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const mapped = savingsErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('Error linking planned expense to savings:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}

/** Unlinks a planned expense from its bucket; closing the bucket with leftover requires `disposition`. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await loadContext(req, id);
    if ('error' in ctx) return ctx.error;
    const { user, plannedExpense } = ctx;

    const body = await readJson(req);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const disposition = parseDisposition(body.disposition);
    if (disposition === null) return NextResponse.json({ error: 'Invalid disposition' }, { status: 400 });

    const bucketId = plannedExpense.savingsBucketId;
    if (!bucketId || plannedExpense.status !== 'PENDING') {
      return NextResponse.json({ error: 'Planned expense is not linked to savings' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.plannedExpense.update({
        where: { id: plannedExpense.id },
        data: { savingsBucketId: null },
      });
      const bucket = await tx.savingsBucket.findUnique({ where: { id: bucketId } });
      await tx.activityLog.create({
        data: {
          walletId: plannedExpense.walletId,
          userId: user.id,
          action: 'PLANNED_EXPENSE_UNLINKED',
          details: `${user.name} stopped saving for "${plannedExpense.title}" in "${bucket?.name ?? ''}"`,
        },
      });
      const lifecycle = await closeBucketIfEmpty(tx, bucketId, user, disposition);
      return { plannedExpense: updated, bucketClosed: lifecycle.closed };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const mapped = savingsErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('Error unlinking planned expense from savings:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}
