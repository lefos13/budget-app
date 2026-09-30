import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadBucketForWrite } from '@/lib/savings-server';

/** Renames a sub-bucket (active or closed). Body: `{ name }`. General keeps its fixed, translated label. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ bucketId: string }> }) {
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

    if (bucket.kind === 'GENERAL') {
      return NextResponse.json({ error: 'General savings cannot be renamed' }, { status: 400 });
    }
    const { name } = body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
      return NextResponse.json(
        { error: 'Bucket name must be non-empty and at most 60 characters' },
        { status: 400 }
      );
    }
    const newName = name.trim();
    if (newName === bucket.name) return NextResponse.json({ bucket });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.savingsBucket.update({ where: { id: bucket.id }, data: { name: newName } });
      await tx.activityLog.create({
        data: {
          walletId: bucket.walletId,
          userId: user.id,
          action: 'SAVINGS_BUCKET_RENAMED',
          details: `${user.name} renamed savings bucket "${bucket.name}" to "${newName}"`,
        },
      });
      return result;
    });

    return NextResponse.json({ bucket: updated });
  } catch (error) {
    console.error('Error renaming savings bucket:', error);
    return NextResponse.json({ error: 'Failed to update savings' }, { status: 500 });
  }
}
