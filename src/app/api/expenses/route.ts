import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletId = searchParams.get('walletId');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!walletId) {
      return NextResponse.json({ error: 'walletId is required' }, { status: 400 });
    }

    const where: Prisma.ExpenseWhereInput = { walletId };
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    if (search && search.trim() !== '') {
      where.title = { contains: search.trim() };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        user: true,
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();

    const { walletId, title, amount, categoryId, date, notes, isRecurring } = body;

    if (!walletId || !title || amount === undefined || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Invalid expense data' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        walletId,
        userId: user.id,
        categoryId: categoryId || null,
        title: title.trim(),
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        notes: notes ? notes.trim() : null,
        isRecurring: !!isRecurring,
      },
      include: {
        category: true,
        user: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId,
        userId: user.id,
        action: 'EXPENSE_ADDED',
        details: `${user.name} added expense "${expense.title}" (€${expense.amount.toFixed(2)})`,
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('Error adding expense:', error);
    return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Expense id is required' }, { status: 400 });
    }

    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
