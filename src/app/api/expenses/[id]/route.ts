import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: expense.walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Viewers cannot edit expenses' },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { title, amount, date, categoryId, notes, isRecurring } = body;

    // Validate title: non-empty trimmed <= 120
    let trimmedTitle: string | undefined;
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
        return NextResponse.json(
          { error: 'Title must be non-empty and at most 120 characters' },
          { status: 400 }
        );
      }
      trimmedTitle = title.trim();
    }

    // Validate amount: finite > 0
    let numAmount: number | undefined;
    if (amount !== undefined) {
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
    }

    // Validate date: valid date string
    let parsedDate: Date | undefined;
    if (date !== undefined) {
      if (
        date === null ||
        (typeof date !== 'string' && !(date instanceof Date))
      ) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }

      parsedDate =
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
          ? new Date(`${date.trim()}T00:00:00.000Z`)
          : new Date(date);

      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      }
    }

    // Validate categoryId: null/'' or category of that wallet
    let finalCategoryId: string | null | undefined;
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === '') {
        finalCategoryId = null;
      } else if (typeof categoryId === 'string') {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        });
        if (!category || category.walletId !== expense.walletId) {
          return NextResponse.json(
            { error: 'Invalid category for this wallet' },
            { status: 400 }
          );
        }
        finalCategoryId = categoryId;
      } else {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
    }

    // Validate notes: trimmed or null
    let finalNotes: string | null | undefined;
    if (notes !== undefined) {
      if (notes === null || notes === '') {
        finalNotes = null;
      } else if (typeof notes === 'string') {
        finalNotes = notes.trim() || null;
      } else {
        return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
      }
    }

    // Validate isRecurring: boolean
    let finalIsRecurring: boolean | undefined;
    if (isRecurring !== undefined) {
      if (typeof isRecurring !== 'boolean') {
        return NextResponse.json({ error: 'isRecurring must be a boolean' }, { status: 400 });
      }
      finalIsRecurring = isRecurring;
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(trimmedTitle !== undefined ? { title: trimmedTitle } : {}),
        ...(numAmount !== undefined ? { amount: numAmount } : {}),
        ...(parsedDate !== undefined ? { date: parsedDate } : {}),
        ...(finalCategoryId !== undefined ? { categoryId: finalCategoryId } : {}),
        ...(finalNotes !== undefined ? { notes: finalNotes } : {}),
        ...(finalIsRecurring !== undefined ? { isRecurring: finalIsRecurring } : {}),
      },
      include: {
        category: true,
        user: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId: expense.walletId,
        userId: user.id,
        action: 'EXPENSE_UPDATED',
        details: `${user.name} updated expense "${updated.title}"`,
      },
    });

    return NextResponse.json({ expense: updated });
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}
