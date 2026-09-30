import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { addRecurrenceInterval } from '@/lib/recurrence';
import { getMonthBounds, getMonthKey } from '@/lib/month';

function parsePaidDate(value: unknown): { date?: Date; error?: string } {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== 'string') {
    return { error: 'paidDate must be a string' };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { error: 'paidDate must be in YYYY-MM-DD format' };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const parsed = new Date(value);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() + 1 !== m ||
    parsed.getUTCDate() !== d
  ) {
    return { error: 'paidDate must be a valid calendar date' };
  }
  return { date: parsed };
}

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

    let body: Record<string, unknown> = {};
    const text = await req.text();
    if (text && text.trim().length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let paidDateObj: Date | undefined;
    if (body.paidDate !== undefined) {
      const { date, error } = parsePaidDate(body.paidDate);
      if (error || !date) {
        return NextResponse.json({ error: error || 'Invalid paidDate' }, { status: 400 });
      }
      paidDateObj = date;
    }

    const invoice = await prisma.invoiceBill.findUnique({
      where: { id },
      include: {
        category: true,
        paidByUser: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: invoice.walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.role === 'VIEWER') {
      return NextResponse.json({ error: 'Viewers cannot pay bills' }, { status: 403 });
    }

    // Idempotent: if already PAID, return existing row without changing paidAt/paidBy and without creating anything
    if (invoice.status === 'PAID') {
      return NextResponse.json({ invoice });
    }

    const effectivePaidAt = paidDateObj ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.invoiceBill.updateMany({
        where: {
          id,
          status: { not: 'PAID' },
        },
        data: {
          status: 'PAID',
          paidAt: effectivePaidAt,
          paidByUserId: user.id,
        },
      });

      const updatedInvoice = await tx.invoiceBill.findUnique({
        where: { id },
        include: {
          category: true,
          paidByUser: true,
        },
      });

      if (!updatedInvoice) {
        throw new Error('Invoice not found during update');
      }

      if (updateResult.count === 1) {
        // Subscriptions MUST NEVER be counted as variable expenses and MUST NOT create Expense records
        if (updatedInvoice.type !== 'SUBSCRIPTION') {
          const existingExpense = await tx.expense.findFirst({
            where: {
              invoiceId: invoice.id,
            },
          });

          if (!existingExpense) {
            // A bill is budgeted in the month it is due. Paying it early (before that month starts) must still
            // charge the due month, otherwise it leaves that month's commitments without landing in its spending.
            const { start: dueMonthStart } = getMonthBounds(getMonthKey(new Date(invoice.dueDate)));
            const expenseDate = effectivePaidAt < dueMonthStart ? dueMonthStart : effectivePaidAt;

            await tx.expense.create({
              data: {
                walletId: invoice.walletId,
                userId: user.id,
                categoryId: invoice.categoryId,
                title: invoice.title,
                amount: invoice.amount,
                date: expenseDate,
                invoiceId: invoice.id,
                notes: `Paid bill ${invoice.invoiceNumber || ''} on ${effectivePaidAt.toLocaleDateString()}`.trim(),
              },
            });
          }
        }

        // Recurring roll-forward: when a recurring bill or subscription is paid, create the next occurrence
        const isSubscription = updatedInvoice.type === 'SUBSCRIPTION';
        const effectiveRecurrenceInterval =
          isSubscription && (!updatedInvoice.recurrenceInterval || updatedInvoice.recurrenceInterval === 'NONE')
            ? 'MONTHLY'
            : updatedInvoice.recurrenceInterval;

        const isRecurring =
          isSubscription || (updatedInvoice.isRecurring && effectiveRecurrenceInterval !== 'NONE');

        if (isRecurring && effectiveRecurrenceInterval) {
          const nextDueDate = addRecurrenceInterval(
            new Date(updatedInvoice.dueDate),
            effectiveRecurrenceInterval
          );

          if (nextDueDate) {
            const existingNext = await tx.invoiceBill.findFirst({
              where: {
                walletId: updatedInvoice.walletId,
                title: updatedInvoice.title,
                type: updatedInvoice.type,
                dueDate: nextDueDate,
              },
            });

            if (!existingNext) {
              const now = new Date();
              const startOfTodayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const nextStatus = nextDueDate < startOfTodayLocal ? 'OVERDUE' : 'PENDING';

              await tx.invoiceBill.create({
                data: {
                  walletId: updatedInvoice.walletId,
                  userId: updatedInvoice.userId,
                  categoryId: updatedInvoice.categoryId,
                  title: updatedInvoice.title,
                  amount: updatedInvoice.amount,
                  type: updatedInvoice.type,
                  isRecurring: isSubscription ? true : updatedInvoice.isRecurring,
                  recurrenceInterval: effectiveRecurrenceInterval,
                  reminderDaysBefore: updatedInvoice.reminderDaysBefore,
                  notes: updatedInvoice.notes,
                  invoiceNumber: null,
                  paidAt: null,
                  paidByUserId: null,
                  dueDate: nextDueDate,
                  status: nextStatus,
                },
              });
            }
          }
        }

        await tx.activityLog.create({
          data: {
            walletId: invoice.walletId,
            userId: user.id,
            action: invoice.type === 'SUBSCRIPTION' ? 'SUBSCRIPTION_PAID' : 'BILL_PAID',
            details: `${user.name} marked ${invoice.type === 'SUBSCRIPTION' ? 'subscription' : 'bill'} "${invoice.title}" as paid (€${invoice.amount.toFixed(2)})`,
          },
        });
      }

      return updatedInvoice;
    });

    return NextResponse.json({ invoice: result });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    return NextResponse.json({ error: 'Failed to mark invoice as paid' }, { status: 500 });
  }
}
