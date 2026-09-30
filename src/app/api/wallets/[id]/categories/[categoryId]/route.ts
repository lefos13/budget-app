import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id, categoryId } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: id,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only the wallet owner can manage categories' },
        { status: 403 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.walletId !== id) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, color, icon, monthlyLimit } = body;

    let trimmedName: string | undefined;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) {
        return NextResponse.json(
          { error: 'Name must be non-empty and at most 40 characters' },
          { status: 400 }
        );
      }
      trimmedName = name.trim();

      // Duplicate check in the same wallet excluding itself
      const existingCategories = await prisma.category.findMany({
        where: {
          walletId: id,
          id: { not: categoryId },
        },
        select: { name: true },
      });
      const isDuplicate = existingCategories.some(
        (c) => c.name.trim().toLowerCase() === trimmedName!.toLowerCase()
      );
      if (isDuplicate) {
        return NextResponse.json(
          { error: 'A category with this name already exists in this wallet' },
          { status: 409 }
        );
      }
    }

    let finalColor: string | undefined;
    if (color !== undefined) {
      if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
        return NextResponse.json(
          { error: 'Color must match hex format /^#[0-9a-fA-F]{6}$/' },
          { status: 400 }
        );
      }
      finalColor = color.trim();
    }

    let finalIcon: string | undefined;
    if (icon !== undefined) {
      if (typeof icon !== 'string' || !/^[A-Za-z0-9]{1,30}$/.test(icon.trim())) {
        return NextResponse.json(
          { error: 'Icon must be 1-30 alphanumeric characters' },
          { status: 400 }
        );
      }
      finalIcon = icon.trim();
    }

    let finalMonthlyLimit: number | null | undefined;
    if (monthlyLimit !== undefined) {
      if (monthlyLimit === null || monthlyLimit === '') {
        finalMonthlyLimit = null;
      } else {
        const num = typeof monthlyLimit === 'number'
          ? monthlyLimit
          : (typeof monthlyLimit === 'string' && monthlyLimit.trim() !== '' ? Number(monthlyLimit) : NaN);
        if (isNaN(num) || !isFinite(num) || num < 0) {
          return NextResponse.json(
            { error: 'Monthly limit must be a non-negative finite number or null' },
            { status: 400 }
          );
        }
        finalMonthlyLimit = num;
      }
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(trimmedName !== undefined ? { name: trimmedName } : {}),
        ...(finalColor !== undefined ? { color: finalColor } : {}),
        ...(finalIcon !== undefined ? { icon: finalIcon } : {}),
        ...(monthlyLimit !== undefined ? { monthlyLimit: finalMonthlyLimit } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId: id,
        userId: user.id,
        action: 'CATEGORY_UPDATED',
        details: `${user.name} updated category "${updated.name}"`,
      },
    });

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id, categoryId } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: id,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only the wallet owner can manage categories' },
        { status: 403 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.walletId !== id) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const detached = await prisma.$transaction(async (tx) => {
      const expensesRes = await tx.expense.updateMany({
        where: { categoryId },
        data: { categoryId: null },
      });

      const invoicesRes = await tx.invoiceBill.updateMany({
        where: { categoryId },
        data: { categoryId: null },
      });

      let plannedCount = 0;
      const txAny = tx as unknown as { plannedExpense?: { updateMany: (args: unknown) => Promise<{ count: number }> } };
      if (txAny.plannedExpense?.updateMany) {
        const plannedRes = await txAny.plannedExpense.updateMany({
          where: { categoryId },
          data: { categoryId: null },
        });
        plannedCount = plannedRes.count;
      } else {
        plannedCount = await tx.$executeRawUnsafe(
          'UPDATE "PlannedExpense" SET "categoryId" = NULL WHERE "categoryId" = ?',
          categoryId
        );
      }

      await tx.category.delete({
        where: { id: categoryId },
      });

      await tx.activityLog.create({
        data: {
          walletId: id,
          userId: user.id,
          action: 'CATEGORY_DELETED',
          details: `${user.name} deleted category "${category.name}"`,
        },
      });

      return {
        expenses: expensesRes.count,
        invoices: invoicesRes.count,
        plannedExpenses: plannedCount,
      };
    });

    return NextResponse.json({
      success: true,
      detached,
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
