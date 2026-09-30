import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getCurrentMonthKey, isValidMonthKey } from '@/lib/month';
import { allocate, computeBucketMonth, round2 } from '@/lib/savings';
import { getOrCreateGeneralBucket, loadSavingsInputs } from '@/lib/savings-server';

/**
 * Savings overview for a wallet and month: General pool, active sub-buckets (balance, target, allocation
 * per linked expense, contribution due), and closed buckets.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: id, userId: user.id } },
    });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const monthParam = new URL(req.url).searchParams.get('month');
    if (monthParam !== null && !isValidMonthKey(monthParam)) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    }
    const now = new Date();
    const month = monthParam ?? getCurrentMonthKey(now);

    await getOrCreateGeneralBucket(prisma, id);
    const { buckets, inputs } = await loadSavingsInputs(prisma, id);

    let general = null;
    const active = [];
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.kind !== 'GENERAL' && bucket.status !== 'ACTIVE') continue; // listed under closedBuckets
      const figures = computeBucketMonth(inputs[i], month, now);
      if (bucket.kind === 'GENERAL') {
        if (!general) {
          general = {
            id: bucket.id,
            name: bucket.name,
            color: bucket.color,
            icon: bucket.icon,
            balance: figures.balanceNow,
            depositedThisMonth: figures.deposited,
            boostThisMonth: figures.boost,
          };
        }
        continue;
      }
      // "Saved so far" per expense is real money (today's balance), even when viewing a future month;
      // only the contribution figures use the simulated start-of-month balance.
      const shownById = new Map(
        allocate(figures.balanceNow, inputs[i].pending, month).map((a) => [a.id, a])
      );
      const scheduleById = new Map(figures.allocations.map((a) => [a.id, a]));
      active.push({
        id: bucket.id,
        name: bucket.name,
        color: bucket.color,
        icon: bucket.icon,
        status: bucket.status,
        createdAt: bucket.createdAt,
        balance: figures.balanceNow,
        target: figures.target,
        progress: figures.target > 0 ? Math.min(1, round2(figures.balanceNow / figures.target)) : 0,
        contributionDue: figures.contributionDue,
        contributed: figures.contributed,
        savingsDue: figures.savingsDue,
        deposited: figures.deposited,
        nextDueDate: bucket.plannedExpenses[0]?.expectedDate ?? null,
        expenses: bucket.plannedExpenses.map((p) => {
          const alloc = shownById.get(p.id);
          const schedule = scheduleById.get(p.id);
          return {
            id: p.id,
            title: p.title,
            amount: p.amount,
            expectedDate: p.expectedDate,
            categoryId: p.categoryId,
            allocated: alloc?.allocated ?? 0,
            remaining: alloc?.remaining ?? p.amount,
            monthsLeft: schedule?.monthsLeft ?? 0,
            contribution: schedule?.contribution ?? 0,
            trackFromMonth: p.trackFromMonth ?? null,
            isTrackingActive: schedule?.isTrackingActive ?? true,
          };
        }),
      });
    }

    const closedBuckets = await prisma.savingsBucket.findMany({
      where: { walletId: id, kind: 'GOAL', status: 'CLOSED' },
      include: {
        plannedExpenses: { select: { id: true, title: true, amount: true, status: true, expectedDate: true } },
      },
      orderBy: { closedAt: 'desc' },
    });

    return NextResponse.json({
      month,
      general,
      buckets: active,
      closedBuckets: closedBuckets.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.color,
        icon: b.icon,
        closedAt: b.closedAt,
        expenses: b.plannedExpenses,
      })),
      totals: {
        saved: round2((general?.balance ?? 0) + active.reduce((s, b) => s + b.balance, 0)),
        savingsDue: round2(active.reduce((s, b) => s + b.savingsDue, 0)),
        deposited: round2(
          (general?.depositedThisMonth ?? 0) + active.reduce((s, b) => s + b.deposited, 0)
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching savings:', error);
    return NextResponse.json({ error: 'Failed to fetch savings' }, { status: 500 });
  }
}
