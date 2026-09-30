import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { canLinkToSavings } from '@/lib/savings';
import { closeBucketIfEmpty, parseDisposition, savingsErrorResponse } from '@/lib/savings-server';

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
    const plannedExpense = await prisma.plannedExpense.findUnique({
      where: { id },
    });

    if (!plannedExpense) {
      return NextResponse.json({ error: 'Planned expense not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: plannedExpense.walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Viewers cannot edit planned expenses' },
        { status: 403 }
      );
    }

    if (plannedExpense.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Realized planned expenses cannot be edited' },
        { status: 409 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { title, amount, expectedDate, categoryId, notes } = body;
    const disposition = parseDisposition(body.disposition);
    if (disposition === null) {
      return NextResponse.json({ error: 'Invalid disposition' }, { status: 400 });
    }

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

    // Validate expectedDate: valid date
    let parsedExpectedDate: Date | undefined;
    if (expectedDate !== undefined) {
      if (
        expectedDate === null ||
        (typeof expectedDate !== 'string' && !(expectedDate instanceof Date))
      ) {
        return NextResponse.json({ error: 'Invalid expected date' }, { status: 400 });
      }

      parsedExpectedDate =
        typeof expectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expectedDate.trim())
          ? new Date(`${expectedDate.trim()}T00:00:00.000Z`)
          : new Date(expectedDate);

      if (isNaN(parsedExpectedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expected date' }, { status: 400 });
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
        if (!category || category.walletId !== plannedExpense.walletId) {
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

    // A linked expense moved into the current or a past month stops being saved for (unlinked);
    // its bucket closes if that was its last pending expense (leftover needs a disposition).
    const unlinkBucketId =
      plannedExpense.savingsBucketId && parsedExpectedDate && !canLinkToSavings(parsedExpectedDate)
        ? plannedExpense.savingsBucketId
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.plannedExpense.update({
        where: { id },
        data: {
          ...(trimmedTitle !== undefined ? { title: trimmedTitle } : {}),
          ...(numAmount !== undefined ? { amount: numAmount } : {}),
          ...(parsedExpectedDate !== undefined ? { expectedDate: parsedExpectedDate } : {}),
          ...(finalCategoryId !== undefined ? { categoryId: finalCategoryId } : {}),
          ...(finalNotes !== undefined ? { notes: finalNotes } : {}),
          ...(unlinkBucketId ? { savingsBucketId: null } : {}),
        },
        include: {
          category: true,
        },
      });

      await tx.activityLog.create({
        data: {
          walletId: plannedExpense.walletId,
          userId: user.id,
          action: 'PLANNED_EXPENSE_UPDATED',
          details: `${user.name} updated planned expense "${result.title}"`,
        },
      });

      if (unlinkBucketId) {
        await tx.activityLog.create({
          data: {
            walletId: plannedExpense.walletId,
            userId: user.id,
            action: 'PLANNED_EXPENSE_UNLINKED',
            details: `${user.name} moved "${result.title}" to the current or a past month, so it is no longer saved for`,
          },
        });
        await closeBucketIfEmpty(tx, unlinkBucketId, user, disposition);
      }
      return result;
    });

    return NextResponse.json({ plannedExpense: updated, unlinkedFromSavings: Boolean(unlinkBucketId) });
  } catch (error) {
    const mapped = savingsErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('Error updating planned expense:', error);
    return NextResponse.json({ error: 'Failed to update planned expense' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const plannedExpense = await prisma.plannedExpense.findUnique({
      where: { id },
    });

    if (!plannedExpense) {
      return NextResponse.json({ error: 'Planned expense not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: plannedExpense.walletId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Viewers cannot delete planned expenses' },
        { status: 403 }
      );
    }

    let disposition: ReturnType<typeof parseDisposition>;
    try {
      const text = await req.text();
      disposition = text.trim() ? parseDisposition(JSON.parse(text)?.disposition) : undefined;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (disposition === null) {
      return NextResponse.json({ error: 'Invalid disposition' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.plannedExpense.delete({
        where: { id },
      });

      await tx.activityLog.create({
        data: {
          walletId: plannedExpense.walletId,
          userId: user.id,
          action: 'PLANNED_EXPENSE_DELETED',
          details: `${user.name} deleted planned expense "${plannedExpense.title}"`,
        },
      });

      if (plannedExpense.savingsBucketId && plannedExpense.status === 'PENDING') {
        await closeBucketIfEmpty(tx, plannedExpense.savingsBucketId, user, disposition);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const mapped = savingsErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('Error deleting planned expense:', error);
    return NextResponse.json({ error: 'Failed to delete planned expense' }, { status: 500 });
  }
}
