import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletId = searchParams.get('walletId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    if (!walletId) {
      return NextResponse.json({ error: 'walletId is required' }, { status: 400 });
    }

    const where: Prisma.InvoiceBillWhereInput = { walletId };
    if (type && type !== 'ALL') {
      (where as Record<string, unknown>).type = type.toUpperCase();
    }

    const invoices = await prisma.invoiceBill.findMany({
      where,
      include: {
        category: true,
        paidByUser: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const updatedInvoices = invoices.map((inv) => {
      const due = new Date(inv.dueDate);
      if (inv.status === 'PENDING' && due < today) {
        return { ...inv, status: 'OVERDUE' };
      }
      return inv;
    });

    const filtered = status && status !== 'ALL'
      ? updatedInvoices.filter((i) => i.status === status)
      : updatedInvoices;

    return NextResponse.json({ invoices: filtered });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();

    const {
      walletId,
      title,
      amount,
      dueDate,
      type = 'BILL',
      categoryId,
      invoiceNumber,
      notes,
      isRecurring = false,
      recurrenceInterval = 'NONE',
      reminderDaysBefore = 3,
    } = body;

    if (!walletId || !title || amount === undefined || !dueDate) {
      return NextResponse.json({ error: 'Missing required bill fields' }, { status: 400 });
    }

    const normalizedType = type && type.toUpperCase() === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'BILL';
    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const initialStatus = due < today ? 'OVERDUE' : 'PENDING';

    const invoice = await prisma.invoiceBill.create({
      data: {
        walletId,
        userId: user.id,
        categoryId: categoryId || null,
        title: title.trim(),
        amount: parseFloat(amount),
        type: normalizedType,
        dueDate: due,
        status: initialStatus,
        isRecurring: normalizedType === 'SUBSCRIPTION' ? true : !!isRecurring,
        recurrenceInterval: isRecurring || normalizedType === 'SUBSCRIPTION' ? (recurrenceInterval === 'NONE' && normalizedType === 'SUBSCRIPTION' ? 'MONTHLY' : recurrenceInterval) : 'NONE',
        reminderDaysBefore: parseInt(reminderDaysBefore) || 3,
        invoiceNumber: invoiceNumber ? invoiceNumber.trim() : null,
        notes: notes ? notes.trim() : null,
      },
      include: {
        category: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId,
        userId: user.id,
        action: normalizedType === 'SUBSCRIPTION' ? 'SUBSCRIPTION_ADDED' : 'BILL_ADDED',
        details: `${user.name} added upcoming ${normalizedType.toLowerCase()} "${invoice.title}" (€${invoice.amount.toFixed(2)}) due ${invoice.dueDate.toISOString().slice(0, 10)}`,
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 });
    }

    await prisma.invoiceBill.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
