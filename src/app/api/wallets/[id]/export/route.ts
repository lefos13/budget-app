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
          include: { category: true },
          orderBy: { date: 'asc' },
        },
        invoices: {
          include: { category: true },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = wallet.members.find((m) => m.userId === user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const exportData = {
      version: '1.0',
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
      expenses: wallet.expenses.map((e) => ({
        title: e.title,
        amount: e.amount,
        date: e.date.toISOString(),
        categoryName: e.category ? e.category.name : null,
        notes: e.notes,
        isRecurring: e.isRecurring,
      })),
      invoices: wallet.invoices.map((i) => ({
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
      })),
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
