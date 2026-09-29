import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Users
  const alex = await prisma.user.upsert({
    where: { email: 'alex@example.com' },
    update: {},
    create: {
      email: 'alex@example.com',
      name: 'Alex Johnson',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  const elena = await prisma.user.upsert({
    where: { email: 'elena@example.com' },
    update: {},
    create: {
      email: 'elena@example.com',
      name: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
  });

  await prisma.user.upsert({
    where: { email: 'marcus@example.com' },
    update: {},
    create: {
      email: 'marcus@example.com',
      name: 'Marcus Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
  });

  // 2. Create Shared Household Wallet
  let householdWallet = await prisma.wallet.findFirst({
    where: { name: 'Household & Living' },
  });

  if (!householdWallet) {
    householdWallet = await prisma.wallet.create({
      data: {
        name: 'Household & Living',
        currency: 'EUR',
        monthlyBudget: 2800.0,
        color: '#6366f1',
        icon: 'Home',
        members: {
          create: [
            { userId: alex.id, role: 'OWNER' },
            { userId: elena.id, role: 'MEMBER' },
          ],
        },
        invites: {
          create: [
            {
              code: 'HOUSE-SHARE-2026',
              role: 'MEMBER',
              maxUses: 5,
            },
          ],
        },
      },
    });
  }

  // 3. Create Personal Wallet
  let personalWallet = await prisma.wallet.findFirst({
    where: { name: 'Personal Vault' },
  });

  if (!personalWallet) {
    personalWallet = await prisma.wallet.create({
      data: {
        name: 'Personal Vault',
        currency: 'EUR',
        monthlyBudget: 950.0,
        color: '#0ea5e9',
        icon: 'Wallet',
        members: {
          create: [{ userId: alex.id, role: 'OWNER' }],
        },
        invites: {
          create: [
            {
              code: 'PERSONAL-INVITE',
              role: 'VIEWER',
              maxUses: 1,
            },
          ],
        },
      },
    });
  }

  // 4. Create Categories for Household Wallet
  const categoriesData = [
    { name: 'Rent & Housing', icon: 'Home', color: '#6366f1', monthlyLimit: 1100 },
    { name: 'Utilities & WiFi', icon: 'Zap', color: '#f59e0b', monthlyLimit: 280 },
    { name: 'Groceries & Supplies', icon: 'ShoppingCart', color: '#10b981', monthlyLimit: 650 },
    { name: 'Dining & Takeout', icon: 'Utensils', color: '#ec4899', monthlyLimit: 250 },
    { name: 'Subscriptions', icon: 'Tv', color: '#8b5cf6', monthlyLimit: 120 },
    { name: 'Transport & Fuel', icon: 'Car', color: '#06b6d4', monthlyLimit: 200 },
    { name: 'Health & Wellness', icon: 'HeartPulse', color: '#14b8a6', monthlyLimit: 200 },
  ];

  const categoriesMap: Record<string, string> = {};

  for (const cat of categoriesData) {
    const existing = await prisma.category.findFirst({
      where: { walletId: householdWallet.id, name: cat.name },
    });
    if (!existing) {
      const created = await prisma.category.create({
        data: {
          walletId: householdWallet.id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          monthlyLimit: cat.monthlyLimit,
        },
      });
      categoriesMap[cat.name] = created.id;
    } else {
      categoriesMap[cat.name] = existing.id;
    }
  }

  // 5. Create Invoices & Bills
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const bills = [
    {
      title: 'Monthly Rent',
      amount: 1100.0,
      dueDate: new Date(year, month, Math.min(day + 2, 28)),
      status: 'PENDING',
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      reminderDaysBefore: 3,
      invoiceNumber: 'RENT-OCT-2026',
      notes: 'Bank transfer to landlord Elena V.',
      categoryName: 'Rent & Housing',
      userId: alex.id,
    },
    {
      title: 'Electricity & Power (PPC)',
      amount: 142.3,
      dueDate: new Date(year, month, Math.min(day + 1, 28)),
      status: 'PENDING',
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      reminderDaysBefore: 3,
      invoiceNumber: 'INV-ELEC-8891',
      notes: 'Peak autumn usage bill',
      categoryName: 'Utilities & WiFi',
      userId: elena.id,
    },
    {
      title: 'Fiber Internet 500Mbps',
      amount: 38.9,
      dueDate: new Date(year, month, Math.min(day + 5, 28)),
      status: 'PENDING',
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      reminderDaysBefore: 2,
      invoiceNumber: 'COSM-7729',
      notes: 'Direct debit fallback if not paid manually',
      categoryName: 'Utilities & WiFi',
      userId: alex.id,
    },
    {
      title: 'Water Supply Service',
      amount: 44.5,
      dueDate: new Date(year, month, Math.min(day + 11, 28)),
      status: 'PENDING',
      isRecurring: true,
      recurrenceInterval: 'QUARTERLY',
      reminderDaysBefore: 4,
      invoiceNumber: 'EYDAP-4100',
      notes: 'Quarterly water consumption bill',
      categoryName: 'Utilities & WiFi',
      userId: elena.id,
    },
    {
      title: 'Building Maintenance & Heating',
      amount: 65.0,
      dueDate: new Date(year, month, Math.max(day - 2, 1)), // Overdue!
      status: 'OVERDUE',
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      reminderDaysBefore: 3,
      invoiceNumber: 'BLD-OCT-09',
      notes: 'Common expenses fee for September/October',
      categoryName: 'Rent & Housing',
      userId: alex.id,
    },
    {
      title: 'Netflix 4K + Spotify Duo',
      amount: 32.98,
      dueDate: new Date(year, month, Math.max(day - 5, 2)),
      status: 'PAID',
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
      reminderDaysBefore: 2,
      invoiceNumber: 'SUB-NETFLIX-99',
      notes: 'Paid via Revolut card',
      categoryName: 'Subscriptions',
      userId: alex.id,
      paidAt: new Date(year, month, Math.max(day - 5, 2)),
      paidByUserId: elena.id,
    },
  ];

  for (const bill of bills) {
    const existing = await prisma.invoiceBill.findFirst({
      where: { walletId: householdWallet.id, title: bill.title },
    });
    if (!existing) {
      await prisma.invoiceBill.create({
        data: {
          walletId: householdWallet.id,
          userId: bill.userId,
          categoryId: categoriesMap[bill.categoryName],
          title: bill.title,
          amount: bill.amount,
          dueDate: bill.dueDate,
          status: bill.status,
          isRecurring: bill.isRecurring,
          recurrenceInterval: bill.recurrenceInterval,
          reminderDaysBefore: bill.reminderDaysBefore,
          invoiceNumber: bill.invoiceNumber,
          notes: bill.notes,
          paidAt: bill.paidAt,
          paidByUserId: bill.paidByUserId,
        },
      });
    }
  }

  // 6. Create Recent Expenses
  const expenses = [
    {
      title: 'Weekly Organic Market Groceries',
      amount: 142.8,
      date: new Date(year, month, Math.max(day - 1, 1)),
      categoryName: 'Groceries & Supplies',
      userId: alex.id,
      notes: 'Fruits, veggies, olive oil, and sourdough',
    },
    {
      title: 'Sklavenitis Supermarket run',
      amount: 98.4,
      date: new Date(year, month, Math.max(day - 3, 1)),
      categoryName: 'Groceries & Supplies',
      userId: elena.id,
      notes: 'Detergent, pantry staples & coffee beans',
    },
    {
      title: 'Dinner at Osteria Da Nico',
      amount: 68.0,
      date: new Date(year, month, Math.max(day - 4, 1)),
      categoryName: 'Dining & Takeout',
      userId: alex.id,
      notes: 'Shared pasta and wine with friends',
    },
    {
      title: 'Gasoline refill (Shell)',
      amount: 70.0,
      date: new Date(year, month, Math.max(day - 6, 1)),
      categoryName: 'Transport & Fuel',
      userId: alex.id,
      notes: 'Full tank for weekend trip',
    },
    {
      title: 'Pharmacy supplies & vitamins',
      amount: 34.5,
      date: new Date(year, month, Math.max(day - 7, 1)),
      categoryName: 'Health & Wellness',
      userId: elena.id,
      notes: 'Winter supplements and first aid',
    },
    {
      title: 'Netflix 4K + Spotify Duo',
      amount: 32.98,
      date: new Date(year, month, Math.max(day - 5, 2)),
      categoryName: 'Subscriptions',
      userId: elena.id,
      notes: 'Monthly digital services',
    },
  ];

  for (const exp of expenses) {
    const existing = await prisma.expense.findFirst({
      where: { walletId: householdWallet.id, title: exp.title },
    });
    if (!existing) {
      await prisma.expense.create({
        data: {
          walletId: householdWallet.id,
          userId: exp.userId,
          categoryId: categoriesMap[exp.categoryName],
          title: exp.title,
          amount: exp.amount,
          date: exp.date,
          notes: exp.notes,
        },
      });
    }
  }

  // 7. Activity Logs
  const activities = [
    {
      action: 'MEMBER_JOINED',
      details: 'Elena Rostova joined the wallet Household & Living',
      userId: elena.id,
      timestamp: new Date(year, month, Math.max(day - 10, 1)),
    },
    {
      action: 'EXPENSE_ADDED',
      details: 'Alex Johnson added expense "Weekly Organic Market Groceries" (€142.80)',
      userId: alex.id,
      timestamp: new Date(year, month, Math.max(day - 1, 1)),
    },
    {
      action: 'BILL_PAID',
      details: 'Elena Rostova marked "Netflix 4K + Spotify Duo" as paid (€32.98)',
      userId: elena.id,
      timestamp: new Date(year, month, Math.max(day - 5, 2)),
    },
  ];

  for (const act of activities) {
    await prisma.activityLog.create({
      data: {
        walletId: householdWallet.id,
        userId: act.userId,
        action: act.action,
        details: act.details,
        timestamp: act.timestamp,
      },
    });
  }

  console.log('✅ Database seeded successfully with demo wallets, users, and bills!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
