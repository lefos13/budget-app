import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { isValidMonthKey, getMonthBounds } from '@/lib/month';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const walletId = searchParams.get('walletId');
    const month = searchParams.get('month');

    if (!walletId) {
      return NextResponse.json({ error: 'walletId is required' }, { status: 400 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Prisma.PlannedExpenseWhereInput = { walletId };

    if (month !== null) {
      if (!isValidMonthKey(month)) {
        return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
      }
      const { start, end } = getMonthBounds(month);
      where.expectedDate = { gte: start, lte: end };
    }

    const plannedExpenses = await prisma.plannedExpense.findMany({
      where,
      include: {
        category: true,
        user: true,
      },
      orderBy: { expectedDate: 'asc' },
    });

    return NextResponse.json({ plannedExpenses });
  } catch (error) {
    console.error('Error fetching planned expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch planned expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { walletId, title, amount, expectedDate, categoryId, notes } = body;

    if (!walletId || typeof walletId !== 'string') {
      return NextResponse.json({ error: 'walletId is required' }, { status: 400 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.role === 'VIEWER') {
      return NextResponse.json({ error: 'Viewers cannot create planned expenses' }, { status: 403 });
    }

    // Validate title: non-empty trimmed <= 120
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
      return NextResponse.json(
        { error: 'Title must be non-empty and at most 120 characters' },
        { status: 400 }
      );
    }
    const trimmedTitle = title.trim();

    // Validate amount: finite > 0
    let numAmount: number;
    if (typeof amount === 'number') {
      numAmount = amount;
    } else if (typeof amount === 'string' && amount.trim() !== '') {
      numAmount = Number(amount);
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

    // Validate expectedDate: valid date
    if (
      expectedDate === undefined ||
      expectedDate === null ||
      (typeof expectedDate !== 'string' && !(expectedDate instanceof Date))
    ) {
      return NextResponse.json({ error: 'Invalid expected date' }, { status: 400 });
    }

    const parsedExpectedDate =
      typeof expectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expectedDate.trim())
        ? new Date(`${expectedDate.trim()}T00:00:00.000Z`)
        : new Date(expectedDate);

    if (isNaN(parsedExpectedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid expected date' }, { status: 400 });
    }

    // Validate categoryId: null/'' or category of that wallet
    let finalCategoryId: string | null = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      if (typeof categoryId !== 'string') {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category || category.walletId !== walletId) {
        return NextResponse.json(
          { error: 'Invalid category for this wallet' },
          { status: 400 }
        );
      }
      finalCategoryId = categoryId;
    }

    // Validate notes: trimmed or null
    let finalNotes: string | null = null;
    if (notes !== undefined && notes !== null && notes !== '') {
      if (typeof notes !== 'string') {
        return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
      }
      finalNotes = notes.trim() || null;
    }

    const plannedExpense = await prisma.plannedExpense.create({
      data: {
        walletId,
        userId: user.id,
        categoryId: finalCategoryId,
        title: trimmedTitle,
        amount: numAmount,
        expectedDate: parsedExpectedDate,
        notes: finalNotes,
        status: 'PENDING',
      },
      include: {
        category: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId,
        userId: user.id,
        action: 'PLANNED_EXPENSE_ADDED',
        details: `${user.name} added planned expense "${plannedExpense.title}" (€${plannedExpense.amount.toFixed(2)})`,
      },
    });

    return NextResponse.json({ plannedExpense }, { status: 201 });
  } catch (error) {
    console.error('Error creating planned expense:', error);
    return NextResponse.json({ error: 'Failed to create planned expense' }, { status: 500 });
  }
}
