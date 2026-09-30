import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateIcsCalendar } from '@/lib/ics-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        invoices: {
          include: {
            category: true,
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!wallet) {
      return new NextResponse('Wallet not found', { status: 404 });
    }

    const bills = wallet.invoices.map((inv) => ({
      id: inv.id,
      title: inv.title,
      amount: inv.amount,
      type: inv.type,
      currency: wallet.currency,
      dueDate: inv.dueDate,
      status: inv.status,
      invoiceNumber: inv.invoiceNumber,
      notes: inv.notes,
      categoryName: inv.category?.name || 'General',
      isRecurring: inv.isRecurring,
      recurrenceInterval: inv.recurrenceInterval,
      reminderDaysBefore: inv.reminderDaysBefore,
    }));

    const icsContent = generateIcsCalendar(wallet.name, bills);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${wallet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-bills.ics"`,
        'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating calendar .ics feed:', error);
    return new NextResponse('Error generating calendar feed', { status: 500 });
  }
}
