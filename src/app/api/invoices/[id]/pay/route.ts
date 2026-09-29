import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoiceBill.findUnique({
      where: { id },
      include: { wallet: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updated = await prisma.invoiceBill.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidByUserId: user.id,
      },
      include: {
        category: true,
        paidByUser: true,
      },
    });

    // Subscriptions MUST NEVER be counted as variable expenses and MUST NOT create Expense records
    if (invoice.type !== 'SUBSCRIPTION') {
      const existingExpense = await prisma.expense.findFirst({
        where: {
          walletId: invoice.walletId,
          title: invoice.title,
        },
      });

      if (!existingExpense) {
        await prisma.expense.create({
          data: {
            walletId: invoice.walletId,
            userId: user.id,
            categoryId: invoice.categoryId,
            title: invoice.title,
            amount: invoice.amount,
            date: new Date(),
            notes: `Paid bill ${invoice.invoiceNumber || ''} on ${new Date().toLocaleDateString()}`.trim(),
          },
        });
      }
    }

    await prisma.activityLog.create({
      data: {
        walletId: invoice.walletId,
        userId: user.id,
        action: invoice.type === 'SUBSCRIPTION' ? 'SUBSCRIPTION_PAID' : 'BILL_PAID',
        details: `${user.name} marked ${invoice.type === 'SUBSCRIPTION' ? 'subscription' : 'bill'} "${invoice.title}" as paid (€${invoice.amount.toFixed(2)})`,
      },
    });

    return NextResponse.json({ invoice: updated });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    return NextResponse.json({ error: 'Failed to mark invoice as paid' }, { status: 500 });
  }
}
