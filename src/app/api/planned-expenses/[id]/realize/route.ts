import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { toDateKey } from '@/lib/month';

class AlreadyRealizedError extends Error {
  constructor() {
    super('Already realized');
    this.name = 'AlreadyRealizedError';
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const plannedExpense = await prisma.plannedExpense.findUnique({
      where: { id },
    });

    if (!plannedExpense) {
      return NextResponse.json({ error: 'Planned expense not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: plannedExpense.walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Viewers cannot realize planned expenses' },
        { status: 403 }
      );
    }

    let body: Record<string, unknown> = {};
    const text = await req.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    let finalAmount = plannedExpense.amount;
    if (body.amount !== undefined && body.amount !== null) {
      let numAmount: number;
      if (typeof body.amount === 'number') {
        numAmount = body.amount;
      } else if (typeof body.amount === 'string' && body.amount.trim() !== '') {
        numAmount = Number(body.amount);
      } else {
        return NextResponse.json(
          { error: 'Amount must be a positive finite number' },
          { status: 400 }
        );
      }

      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive finite number' },
          { status: 400 }
        );
      }
      finalAmount = numAmount;
    }

    let expenseDate: Date;
    if (body.date !== undefined && body.date !== null) {
      if (typeof body.date !== 'string') {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }
      const trimmedDate = body.date.trim();
      if (!trimmedDate) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }
      const parsedDate = new Date(trimmedDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        const [y, m, d] = trimmedDate.split('-').map(Number);
        if (
          parsedDate.getUTCFullYear() !== y ||
          parsedDate.getUTCMonth() + 1 !== m ||
          parsedDate.getUTCDate() !== d
        ) {
          return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
        }
      }
      expenseDate = parsedDate;
    } else {
      expenseDate = new Date(toDateKey(new Date()));
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.plannedExpense.updateMany({
        where: {
          id,
          status: 'PENDING',
        },
        data: {
          status: 'REALIZED',
        },
      });

      if (updateResult.count === 0) {
        throw new AlreadyRealizedError();
      }

      const expense = await tx.expense.create({
        data: {
          walletId: plannedExpense.walletId,
          userId: user.id,
          categoryId: plannedExpense.categoryId,
          title: plannedExpense.title,
          amount: finalAmount,
          date: expenseDate,
          notes: plannedExpense.notes,
        },
        include: {
          category: true,
          user: true,
        },
      });

      const updatedPlanned = await tx.plannedExpense.update({
        where: { id },
        data: {
          realizedExpenseId: expense.id,
        },
        include: {
          category: true,
          user: true,
        },
      });

      await tx.activityLog.create({
        data: {
          walletId: plannedExpense.walletId,
          userId: user.id,
          action: 'PLANNED_EXPENSE_REALIZED',
          details: `${user.name} marked planned expense "${plannedExpense.title}" as spent (€${expense.amount.toFixed(2)})`,
        },
      });

      return {
        plannedExpense: updatedPlanned,
        expense,
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AlreadyRealizedError) {
      return NextResponse.json({ error: 'Already realized' }, { status: 409 });
    }
    console.error('Error realizing planned expense:', error);
    return NextResponse.json(
      { error: 'Failed to realize planned expense' },
      { status: 500 }
    );
  }
}
