import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        members: true,
        categories: true,
        expenses: {
          include: { category: true, user: true },
          orderBy: { date: 'asc' },
        },
        invoices: {
          include: { category: true, paidByUser: true },
          orderBy: { dueDate: 'asc' },
        },
        plannedExpenses: {
          include: { category: true, user: true },
          orderBy: { expectedDate: 'asc' },
        },
        savingsBuckets: { orderBy: { createdAt: 'asc' } },
        savingsTransactions: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
        monthBonuses: { orderBy: [{ monthKey: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = wallet.members.find((m) => m.userId === user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Collect all referenced user IDs to resolve author details safely
    const allUserIds = new Set<string>();
    wallet.members.forEach((m) => allUserIds.add(m.userId));
    wallet.expenses.forEach((e) => allUserIds.add(e.userId));
    wallet.invoices.forEach((i) => {
      allUserIds.add(i.userId);
      if (i.paidByUserId) allUserIds.add(i.paidByUserId);
    });
    wallet.plannedExpenses.forEach((p) => allUserIds.add(p.userId));
    wallet.savingsTransactions.forEach((t) => allUserIds.add(t.userId));
    wallet.monthBonuses.forEach((b) => allUserIds.add(b.userId));

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Query all activity logs independently of the wallet route's take: 10
    const activityLogs = await prisma.activityLog.findMany({
      where: { walletId: id },
      include: { user: true },
      orderBy: { timestamp: 'asc' },
    });

    const exportData = {
      version: '2.3',
      exportedAt: new Date().toISOString(),
      wallet: {
        name: wallet.name,
        currency: wallet.currency,
        monthlyBudget: wallet.monthlyBudget,
        color: wallet.color,
        icon: wallet.icon,
      },
      categories: wallet.categories.map((c) => ({
        name: c.name,
        icon: c.icon,
        color: c.color,
        monthlyLimit: c.monthlyLimit,
      })),
      expenses: wallet.expenses.map((e) => {
        const author = userMap.get(e.userId) || e.user;
        return {
          ref: e.id,
          title: e.title,
          amount: e.amount,
          date: e.date.toISOString(),
          categoryName: e.category ? e.category.name : null,
          notes: e.notes,
          isRecurring: e.isRecurring,
          invoiceRef: e.invoiceId || null,
          savingsFundedAmount: e.savingsFundedAmount,
          createdAt: e.createdAt.toISOString(),
          userName: author ? author.name : null,
          userEmail: author ? author.email : null,
        };
      }),
      invoices: wallet.invoices.map((i) => {
        const author = userMap.get(i.userId);
        const payer = i.paidByUserId ? userMap.get(i.paidByUserId) || i.paidByUser : null;
        return {
          ref: i.id,
          seriesRef: i.seriesId,
          title: i.title,
          amount: i.amount,
          type: i.type,
          dueDate: i.dueDate.toISOString(),
          status: i.status,
          categoryName: i.category ? i.category.name : null,
          isRecurring: i.isRecurring,
          recurrenceInterval: i.recurrenceInterval,
          reminderDaysBefore: i.reminderDaysBefore,
          invoiceNumber: i.invoiceNumber,
          notes: i.notes,
          paidAt: i.paidAt ? i.paidAt.toISOString() : null,
          paidBy: payer ? { name: payer.name, email: payer.email } : null,
          createdAt: i.createdAt.toISOString(),
          userName: author ? author.name : null,
          userEmail: author ? author.email : null,
        };
      }),
      plannedExpenses: wallet.plannedExpenses.map((p) => {
        const author = userMap.get(p.userId) || p.user;
        return {
          ref: p.id,
          title: p.title,
          amount: p.amount,
          expectedDate: p.expectedDate.toISOString(),
          notes: p.notes,
          category: p.category ? p.category.name : null,
          categoryName: p.category ? p.category.name : null,
          status: p.status,
          realizedExpenseRef: p.realizedExpenseId || null,
          savingsBucketRef: p.savingsBucketId || null,
          trackFromMonth: p.trackFromMonth ?? null,
          createdAt: p.createdAt.toISOString(),
          userName: author ? author.name : null,
          userEmail: author ? author.email : null,
        };
      }),
      activityLogs: activityLogs.map((l) => ({
        action: l.action,
        details: l.details,
        timestamp: l.timestamp.toISOString(),
        userName: l.user ? l.user.name : null,
        userEmail: l.user ? l.user.email : null,
      })),
      savingsBuckets: wallet.savingsBuckets.map((b) => ({
        ref: b.id,
        kind: b.kind,
        name: b.name,
        color: b.color,
        icon: b.icon,
        status: b.status,
        closedAt: b.closedAt ? b.closedAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      })),
      savingsTransactions: wallet.savingsTransactions.map((t) => {
        const author = userMap.get(t.userId);
        return {
          ref: t.id,
          bucketRef: t.bucketId,
          type: t.type,
          amount: t.amount,
          date: t.date.toISOString(),
          transferGroupId: t.transferGroupId,
          plannedExpenseRef: t.plannedExpenseId,
          expenseRef: t.expenseId,
          note: t.note,
          createdAt: t.createdAt.toISOString(),
          userName: author ? author.name : null,
          userEmail: author ? author.email : null,
        };
      }),
      monthBonuses: wallet.monthBonuses.map((b) => {
        const author = userMap.get(b.userId);
        return {
          monthKey: b.monthKey,
          amount: b.amount,
          label: b.label,
          createdAt: b.createdAt.toISOString(),
          userName: author ? author.name : null,
          userEmail: author ? author.email : null,
        };
      }),
    };

    const fileName = `aura-wallet-${wallet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-backup.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting wallet data:', error);
    return NextResponse.json({ error: 'Failed to export wallet data' }, { status: 500 });
  }
}
