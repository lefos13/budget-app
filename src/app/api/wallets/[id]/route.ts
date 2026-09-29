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
        members: {
          include: {
            user: true,
          },
        },
        categories: true,
        invites: {
          orderBy: { createdAt: 'desc' },
        },
        activityLogs: {
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            user: true,
          },
        },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Check membership
    const membership = wallet.members.find((m) => m.userId === user.id);
    const userRole = membership ? membership.role : 'VIEWER';

    // Current month bounds
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Fetch this month's expenses (variable expenses + one-off paid bills)
    // Subscriptions NEVER create Expense records and do not pollute this query.
    const expenses = await prisma.expense.findMany({
      where: {
        walletId: id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        category: true,
        user: true,
      },
      orderBy: { date: 'desc' },
    });

    const totalSpentMonth = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Compute category spent
    const categorySpending = wallet.categories.map((cat) => {
      const spent = expenses
        .filter((e) => e.categoryId === cat.id)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        ...cat,
        spent,
        percentage: cat.monthlyLimit && cat.monthlyLimit > 0 ? Math.min(100, Math.round((spent / cat.monthlyLimit) * 100)) : 0,
      };
    });

    // Invoices/Bills
    const invoices = await prisma.invoiceBill.findMany({
      where: { walletId: id },
      include: {
        category: true,
        paidByUser: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Mark bills as OVERDUE if dueDate is past and status is PENDING
    const updatedInvoices = invoices.map((inv) => {
      if (inv.status === 'PENDING' && new Date(inv.dueDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        return { ...inv, status: 'OVERDUE' };
      }
      return inv;
    });

    const pendingCount = updatedInvoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE').length;
    const overdueCount = updatedInvoices.filter((i) => i.status === 'OVERDUE').length;
    const paidCount = updatedInvoices.filter((i) => i.status === 'PAID').length;

    // Subscriptions summary metrics
    const subscriptions = updatedInvoices.filter((i) => i.type === 'SUBSCRIPTION');
    const bills = updatedInvoices.filter((i) => i.type !== 'SUBSCRIPTION');

    const monthlySubscriptionsTotal = subscriptions.reduce((sum, s) => {
      if (s.recurrenceInterval === 'YEARLY') return sum + s.amount / 12;
      if (s.recurrenceInterval === 'QUARTERLY') return sum + s.amount / 3;
      if (s.recurrenceInterval === 'WEEKLY') return sum + s.amount * 4.33;
      return sum + s.amount;
    }, 0);

    return NextResponse.json({
      wallet,
      userRole,
      currentUser: user,
      metrics: {
        monthlyBudget: wallet.monthlyBudget,
        totalSpentMonth,
        remainingBudget: Math.max(0, wallet.monthlyBudget - totalSpentMonth),
        pendingCount,
        overdueCount,
        paidCount,
        subscriptionCount: subscriptions.length,
        monthlySubscriptionsTotal: Math.round(monthlySubscriptionsTotal * 100) / 100,
        pendingBillsCount: bills.filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE').length,
      },
      categories: categorySpending,
      recentExpenses: expenses.slice(0, 8),
      invoices: updatedInvoices,
    });
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: id,
          userId: user.id,
        },
      },
    });

    if (membership && membership.role === 'VIEWER') {
      return NextResponse.json({ error: 'Viewers cannot modify wallet settings' }, { status: 403 });
    }

    const body = await req.json();
    const { name, monthlyBudget, currency, color, icon } = body;

    const updated = await prisma.wallet.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(monthlyBudget !== undefined ? { monthlyBudget: parseFloat(monthlyBudget) } : {}),
        ...(currency ? { currency } : {}),
        ...(color ? { color } : {}),
        ...(icon ? { icon } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId: id,
        userId: user.id,
        action: 'WALLET_UPDATED',
        details: `Updated wallet settings (Budget: ${updated.currency} ${updated.monthlyBudget})`,
      },
    });

    return NextResponse.json({ wallet: updated });
  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
  }
}
