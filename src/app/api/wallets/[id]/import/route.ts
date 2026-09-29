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

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        members: true,
        categories: true,
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = wallet.members.find((m) => m.userId === user.id);
    if (!membership || membership.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to import into this wallet' }, { status: 403 });
    }

    const body = await req.json();

    const categoriesToImport = Array.isArray(body.categories) ? body.categories : [];
    const expensesToImport = Array.isArray(body.expenses) ? body.expenses : [];
    const invoicesToImport = Array.isArray(body.invoices) ? body.invoices : [];

    // Map existing categories by normalized name to prevent duplicate creation
    const categoryMap = new Map<string, { id: string; name: string }>(
      wallet.categories.map((c) => [c.name.trim().toLowerCase(), c])
    );

    let importedCategoriesCount = 0;
    for (const cat of categoriesToImport) {
      if (!cat.name || typeof cat.name !== 'string') continue;
      const key = cat.name.trim().toLowerCase();
      if (!categoryMap.has(key)) {
        const createdCat = await prisma.category.create({
          data: {
            walletId: id,
            name: cat.name.trim(),
            icon: cat.icon || 'Tag',
            color: cat.color || '#3b82f6',
            monthlyLimit: typeof cat.monthlyLimit === 'number' ? cat.monthlyLimit : null,
          },
        });
        categoryMap.set(key, createdCat);
        importedCategoriesCount++;
      }
    }

    // Import expenses
    let importedExpensesCount = 0;
    for (const exp of expensesToImport) {
      if (!exp.title || exp.amount === undefined) continue;
      const catKey = exp.categoryName ? exp.categoryName.trim().toLowerCase() : null;
      const categoryId = catKey && categoryMap.has(catKey) ? categoryMap.get(catKey)!.id : null;

      await prisma.expense.create({
        data: {
          walletId: id,
          userId: user.id,
          categoryId,
          title: exp.title.trim(),
          amount: parseFloat(exp.amount),
          date: exp.date ? new Date(exp.date) : new Date(),
          notes: exp.notes ? exp.notes.trim() : null,
          isRecurring: !!exp.isRecurring,
        },
      });
      importedExpensesCount++;
    }

    // Import invoices / bills / subscriptions
    let importedInvoicesCount = 0;
    for (const inv of invoicesToImport) {
      if (!inv.title || inv.amount === undefined || !inv.dueDate) continue;
      const catKey = inv.categoryName ? inv.categoryName.trim().toLowerCase() : null;
      const categoryId = catKey && categoryMap.has(catKey) ? categoryMap.get(catKey)!.id : null;
      const invType = inv.type && inv.type.toUpperCase() === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'BILL';

      await prisma.invoiceBill.create({
        data: {
          walletId: id,
          userId: user.id,
          categoryId,
          title: inv.title.trim(),
          amount: parseFloat(inv.amount),
          type: invType,
          dueDate: new Date(inv.dueDate),
          status: inv.status || 'PENDING',
          isRecurring: invType === 'SUBSCRIPTION' ? true : !!inv.isRecurring,
          recurrenceInterval: inv.recurrenceInterval || (invType === 'SUBSCRIPTION' ? 'MONTHLY' : 'NONE'),
          reminderDaysBefore: parseInt(inv.reminderDaysBefore) || 3,
          invoiceNumber: inv.invoiceNumber ? inv.invoiceNumber.trim() : null,
          notes: inv.notes ? inv.notes.trim() : null,
          paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
        },
      });
      importedInvoicesCount++;
    }

    await prisma.activityLog.create({
      data: {
        walletId: id,
        userId: user.id,
        action: 'DATA_IMPORTED',
        details: `${user.name} imported ${importedCategoriesCount} new categories, ${importedExpensesCount} expenses, and ${importedInvoicesCount} invoices/subscriptions`,
      },
    });

    return NextResponse.json({
      success: true,
      imported: {
        categories: importedCategoriesCount,
        expenses: importedExpensesCount,
        invoices: importedInvoicesCount,
      },
    });
  } catch (error) {
    console.error('Error importing wallet data:', error);
    return NextResponse.json({ error: 'Failed to import wallet data' }, { status: 500 });
  }
}
