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
    const invoice = await prisma.invoiceBill.findUnique({
      where: { id },
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
      return NextResponse.json({ error: 'Viewers cannot edit bills' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      title,
      amount,
      dueDate,
      type,
      categoryId,
      invoiceNumber,
      notes,
      isRecurring,
      recurrenceInterval,
      reminderDaysBefore,
    } = body;

    // Validate title
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
        return NextResponse.json({ error: 'Title must be non-empty and at most 120 characters' }, { status: 400 });
      }
    }

    // Validate amount
    let numAmount: number | undefined;
    if (amount !== undefined) {
      numAmount = typeof amount === 'number' ? amount : (typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : NaN);
      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive finite number' }, { status: 400 });
      }
    }

    // Validate dueDate
    let parsedDueDate: Date | undefined;
    if (dueDate !== undefined) {
      if (typeof dueDate !== 'string' && !(dueDate instanceof Date)) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
      }
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
      }
    }

    // Validate type
    let upperType: 'BILL' | 'SUBSCRIPTION' | undefined;
    if (type !== undefined) {
      if (typeof type !== 'string') {
        return NextResponse.json({ error: 'Type must be BILL or SUBSCRIPTION' }, { status: 400 });
      }
      const norm = type.toUpperCase();
      if (norm !== 'BILL' && norm !== 'SUBSCRIPTION') {
        return NextResponse.json({ error: 'Type must be BILL or SUBSCRIPTION' }, { status: 400 });
      }
      upperType = norm as 'BILL' | 'SUBSCRIPTION';
    }

    // Validate categoryId
    let finalCategoryId: string | null = invoice.categoryId;
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === '') {
        finalCategoryId = null;
      } else if (typeof categoryId === 'string') {
        const cat = await prisma.category.findUnique({
          where: { id: categoryId },
        });
        if (!cat || cat.walletId !== invoice.walletId) {
          return NextResponse.json({ error: 'Invalid category for this wallet' }, { status: 400 });
        }
        finalCategoryId = categoryId;
      } else {
        return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 });
      }
    }

    // Validate invoiceNumber
    let finalInvoiceNumber: string | null = invoice.invoiceNumber;
    if (invoiceNumber !== undefined) {
      if (invoiceNumber === null || invoiceNumber === '') {
        finalInvoiceNumber = null;
      } else if (typeof invoiceNumber === 'string') {
        finalInvoiceNumber = invoiceNumber.trim() || null;
      } else {
        return NextResponse.json({ error: 'Invalid invoiceNumber' }, { status: 400 });
      }
    }

    // Validate notes
    let finalNotes: string | null = invoice.notes;
    if (notes !== undefined) {
      if (notes === null || notes === '') {
        finalNotes = null;
      } else if (typeof notes === 'string') {
        finalNotes = notes.trim() || null;
      } else {
        return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
      }
    }

    // Validate isRecurring
    if (isRecurring !== undefined) {
      if (typeof isRecurring !== 'boolean') {
        return NextResponse.json({ error: 'isRecurring must be a boolean' }, { status: 400 });
      }
    }

    // Validate recurrenceInterval
    const validIntervals = ['NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
    let normInterval: string | undefined;
    if (recurrenceInterval !== undefined) {
      if (typeof recurrenceInterval !== 'string' || !validIntervals.includes(recurrenceInterval.toUpperCase())) {
        return NextResponse.json({ error: 'Invalid recurrence interval' }, { status: 400 });
      }
      normInterval = recurrenceInterval.toUpperCase();
    }

    // Validate reminderDaysBefore
    let numReminderDays: number | undefined;
    if (reminderDaysBefore !== undefined) {
      numReminderDays = typeof reminderDaysBefore === 'number'
        ? reminderDaysBefore
        : (typeof reminderDaysBefore === 'string' && reminderDaysBefore.trim() !== '' ? Number(reminderDaysBefore) : NaN);
      if (!Number.isInteger(numReminderDays) || numReminderDays < 0 || numReminderDays > 60) {
        return NextResponse.json({ error: 'Reminder days must be an integer between 0 and 60' }, { status: 400 });
      }
    }

    // Normalisation identical to POST
    const effectiveType = upperType !== undefined ? upperType : invoice.type;
    const effectiveIsRecurring = isRecurring !== undefined ? isRecurring : invoice.isRecurring;
    const effectiveRecurrenceInterval = normInterval !== undefined ? normInterval : invoice.recurrenceInterval;

    let finalIsRecurring: boolean;
    let finalRecurrenceInterval: string;

    if (effectiveType === 'SUBSCRIPTION') {
      finalIsRecurring = true;
      finalRecurrenceInterval = effectiveRecurrenceInterval === 'NONE' ? 'MONTHLY' : effectiveRecurrenceInterval;
    } else {
      finalIsRecurring = !!effectiveIsRecurring;
      finalRecurrenceInterval = finalIsRecurring ? effectiveRecurrenceInterval : 'NONE';
    }

    // Status & PAID lock checks
    let finalStatus: string;
    const targetDueDate = parsedDueDate !== undefined ? parsedDueDate : invoice.dueDate;

    if (invoice.status === 'PAID') {
      finalStatus = 'PAID';
      if (invoice.type !== 'SUBSCRIPTION') {
        const isAmountChanged = numAmount !== undefined && Math.abs(numAmount - invoice.amount) > 0.0001;
        const isDueDateChanged = parsedDueDate !== undefined && parsedDueDate.getTime() !== invoice.dueDate.getTime();
        const isTypeChanged = upperType !== undefined && upperType !== invoice.type;

        if (isAmountChanged || isDueDateChanged || isTypeChanged) {
          return NextResponse.json({ error: 'Paid bills lock amount, due date and type' }, { status: 400 });
        }
      } else {
        const isTypeChanged = upperType !== undefined && upperType !== invoice.type;
        if (isTypeChanged) {
          return NextResponse.json({ error: 'Paid subscriptions cannot change type' }, { status: 400 });
        }
      }
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      finalStatus = targetDueDate < today ? 'OVERDUE' : 'PENDING';
    }

    const finalTitle = title !== undefined ? (title as string).trim() : invoice.title;
    const finalAmount = numAmount !== undefined ? numAmount : invoice.amount;
    const finalReminderDaysBefore = numReminderDays !== undefined ? numReminderDays : invoice.reminderDaysBefore;

    const updatedInvoice = await prisma.invoiceBill.update({
      where: { id },
      data: {
        title: finalTitle,
        amount: finalAmount,
        type: effectiveType,
        dueDate: targetDueDate,
        status: finalStatus,
        categoryId: finalCategoryId,
        invoiceNumber: finalInvoiceNumber,
        notes: finalNotes,
        isRecurring: finalIsRecurring,
        recurrenceInterval: finalRecurrenceInterval,
        reminderDaysBefore: finalReminderDaysBefore,
      },
      include: {
        category: true,
        paidByUser: true,
      },
    });

    const typeLabel = updatedInvoice.type === 'SUBSCRIPTION' ? 'subscription' : 'bill';
    await prisma.activityLog.create({
      data: {
        walletId: invoice.walletId,
        userId: user.id,
        action: updatedInvoice.type === 'SUBSCRIPTION' ? 'SUBSCRIPTION_UPDATED' : 'BILL_UPDATED',
        details: `${user.name} updated ${typeLabel} "${updatedInvoice.title}"`,
      },
    });

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
