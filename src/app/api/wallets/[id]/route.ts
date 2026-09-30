import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { isValidMonthKey, getCurrentMonthKey, getMonthBounds } from '@/lib/month';
import { computeMonthProjection } from '@/lib/month-projection';
import { computeSavingsMonth, round2 } from '@/lib/savings';
import { loadSavingsInputs } from '@/lib/savings-server';

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

    // Effective month and bounds
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const effectiveMonth = monthParam && isValidMonthKey(monthParam) ? monthParam : getCurrentMonthKey();
    const { start: startOfMonth, end: endOfMonth } = getMonthBounds(effectiveMonth);
    const now = new Date();

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

    // Only the part of an expense NOT covered by savings counts against the month (savings-funded share
    // was already budgeted through the monthly deposits).
    const netAmount = (exp: { amount: number; savingsFundedAmount: number }) =>
      Math.max(0, exp.amount - (exp.savingsFundedAmount ?? 0));
    const totalSpentMonth = round2(expenses.reduce((sum, exp) => sum + netAmount(exp), 0));

    // Compute category spent
    const categorySpending = wallet.categories.map((cat) => {
      const spent = expenses
        .filter((e) => e.categoryId === cat.id)
        .reduce((sum, e) => sum + netAmount(e), 0);
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

    const plannedExpenses = await prisma.plannedExpense.findMany({
      where: {
        walletId: id,
        expectedDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        category: true,
        savingsBucket: { select: { id: true, name: true, color: true, status: true } },
      },
      orderBy: { expectedDate: 'asc' },
    });

    const linkedExpenses = await prisma.expense.findMany({
      where: {
        walletId: id,
        invoiceId: { not: null },
      },
      select: {
        invoiceId: true,
        date: true,
      },
    });

    const earliestExpenseDateByInvoiceId = new Map<string, Date>();
    for (const exp of linkedExpenses) {
      if (!exp.invoiceId) continue;
      const existing = earliestExpenseDateByInvoiceId.get(exp.invoiceId);
      if (!existing || exp.date < existing) {
        earliestExpenseDateByInvoiceId.set(exp.invoiceId, exp.date);
      }
    }

    const billInputs = invoices.map((inv) => ({
      type: inv.type,
      amount: inv.amount,
      dueDate: inv.dueDate,
      status: inv.status,
      paidAt: inv.paidAt,
      linkedExpenseDate: earliestExpenseDateByInvoiceId.get(inv.id) ?? null,
    }));

    const { inputs: savingsInputs } = await loadSavingsInputs(prisma, id);
    const savingsMonth = computeSavingsMonth(savingsInputs, effectiveMonth, now);

    const plannedInputs = plannedExpenses.map((pe) => ({
      amount: pe.amount,
      expectedDate: pe.expectedDate,
      status: pe.status,
      fundedAmount: savingsMonth.fundedByPlannedId[pe.id] ?? 0,
    }));

    const projection = computeMonthProjection({
      monthKey: effectiveMonth,
      monthlyBudget: wallet.monthlyBudget,
      spent: totalSpentMonth,
      bills: billInputs,
      planned: plannedInputs,
      savings: {
        deposited: savingsMonth.deposited,
        savingsDue: savingsMonth.savingsDue,
        boost: savingsMonth.boost,
      },
    });

    return NextResponse.json({
      wallet,
      userRole,
      currentUser: user,
      month: effectiveMonth,
      monthExpenses: expenses,
      plannedExpenses,
      metrics: {
        monthlyBudget: wallet.monthlyBudget,
        totalSpentMonth,
        remainingBudget: Math.max(
          0,
          round2(wallet.monthlyBudget + savingsMonth.boost - totalSpentMonth - savingsMonth.deposited)
        ),
        savings: {
          deposited: savingsMonth.deposited,
          savingsDue: savingsMonth.savingsDue,
          boost: savingsMonth.boost,
        },
        pendingCount,
        overdueCount,
        paidCount,
        subscriptionCount: subscriptions.length,
        monthlySubscriptionsTotal: Math.round(monthlySubscriptionsTotal * 100) / 100,
        pendingBillsCount: bills.filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE').length,
        projection,
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

    if (!membership || membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only the wallet owner can edit wallet settings' }, { status: 403 });
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
