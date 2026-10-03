import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateIcsCalendar } from '@/lib/ics-generator';

/**
 * Read-only bills feed for calendar apps. They cannot send cookies, so access is a per-member
 * secret in `?token=` (issued by /api/wallets/[id]/calendar-token). Unknown wallet, missing or
 * wrong token all return the same 404 so the feed never confirms that a wallet exists.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');
    const membership = token
      ? await prisma.walletMember.findUnique({ where: { calendarToken: token } })
      : null;
    if (!membership || membership.walletId !== id) {
      return new NextResponse('Not found', { status: 404 });
    }

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
      return new NextResponse('Not found', { status: 404 });
    }

    const bills = wallet.invoices.map((inv) => ({
      id: inv.id,
      seriesId: inv.seriesId,
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
