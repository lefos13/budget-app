import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { GET as exportRoute } from '../src/app/api/wallets/[id]/export/route';
import { POST as importRoute } from '../src/app/api/wallets/[id]/import/route';
import { POST as payInvoiceRoute } from '../src/app/api/invoices/[id]/pay/route';

import { computeSavingsMonth } from '../src/lib/savings';
import { loadSavingsInputs } from '../src/lib/savings-server';
import { getCurrentMonthKey } from '../src/lib/month';
async function run() {
  console.log('🧪 Starting Wallet Export/Import Roundtrip & Fidelity Test Suite...\n');

  const createdWalletIds: string[] = [];
  const createdUserIds: string[] = [];

  const timestamp = Date.now();
  const makeEmail = (role: string) => `test-roundtrip-${role}-${timestamp}@example.com`;

  try {
    // ------------------------------------------------------------------------
    // Setup test users
    // ------------------------------------------------------------------------
    const ownerUser = await prisma.user.create({
      data: {
        name: 'Roundtrip Owner',
        email: makeEmail('owner'),
      },
    });
    createdUserIds.push(ownerUser.id);

    const memberUser = await prisma.user.create({
      data: {
        name: 'Roundtrip Member',
        email: makeEmail('member'),
      },
    });
    createdUserIds.push(memberUser.id);

    const viewerUser = await prisma.user.create({
      data: {
        name: 'Roundtrip Viewer',
        email: makeEmail('viewer'),
      },
    });
    createdUserIds.push(viewerUser.id);

    const outsiderUser = await prisma.user.create({
      data: {
        name: 'Roundtrip Outsider',
        email: makeEmail('outsider'),
      },
    });
    createdUserIds.push(outsiderUser.id);

    // ------------------------------------------------------------------------
    // Test 1: Full-Fidelity Export (v2.0)
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Full-Fidelity Export (v2.0) ---');
    const sourceWallet = await prisma.wallet.create({
      data: {
        name: `Source Wallet ${timestamp}`,
        currency: 'EUR',
        monthlyBudget: 3500,
        members: {
          create: [
            { userId: ownerUser.id, role: 'OWNER' },
            { userId: memberUser.id, role: 'MEMBER' },
            { userId: viewerUser.id, role: 'VIEWER' },
          ],
        },
      },
    });
    createdWalletIds.push(sourceWallet.id);

    const utilCat = await prisma.category.create({
      data: {
        walletId: sourceWallet.id,
        name: 'Utilities',
        icon: 'Zap',
        color: '#f59e0b',
        monthlyLimit: 400,
      },
    });

    const foodCat = await prisma.category.create({
      data: {
        walletId: sourceWallet.id,
        name: 'Groceries',
        icon: 'ShoppingCart',
        color: '#10b981',
        monthlyLimit: 600,
      },
    });

    // Bills: 1 paid bill, 1 unpaid bill, 1 subscription
    const paidBill = await prisma.invoiceBill.create({
      data: {
        walletId: sourceWallet.id,
        userId: ownerUser.id,
        categoryId: utilCat.id,
        title: 'Electricity Bill Q1',
        amount: 145.5,
        type: 'BILL',
        dueDate: new Date('2026-03-15T00:00:00Z'),
        status: 'PAID',
        paidAt: new Date('2026-03-14T10:00:00Z'),
        paidByUserId: memberUser.id,
        invoiceNumber: 'INV-2026-001',
        notes: 'Paid via direct debit',
      },
    });

    await prisma.invoiceBill.create({
      data: {
        walletId: sourceWallet.id,
        userId: memberUser.id,
        categoryId: utilCat.id,
        title: 'Water Utility March',
        amount: 42.0,
        type: 'BILL',
        dueDate: new Date('2026-03-28T00:00:00Z'),
        status: 'PENDING',
      },
    });

    await prisma.invoiceBill.create({
      data: {
        walletId: sourceWallet.id,
        userId: ownerUser.id,
        categoryId: null,
        title: 'Cloud Storage Pro',
        amount: 9.99,
        type: 'SUBSCRIPTION',
        dueDate: new Date('2026-03-01T00:00:00Z'),
        status: 'PENDING',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    });

    // Expenses: 1 independent, 1 linked to paid bill, 1 realized from planned
    const regularExpense = await prisma.expense.create({
      data: {
        walletId: sourceWallet.id,
        userId: ownerUser.id,
        categoryId: foodCat.id,
        title: 'Supermarket Groceries',
        amount: 85.2,
        date: new Date('2026-03-10T12:00:00Z'),
        notes: 'Weekly fresh food',
      },
    });

    const billLinkedExpense = await prisma.expense.create({
      data: {
        walletId: sourceWallet.id,
        userId: memberUser.id,
        categoryId: utilCat.id,
        invoiceId: paidBill.id,
        title: 'Electricity Bill Q1',
        amount: 145.5,
        date: new Date('2026-03-14T10:00:00Z'),
        notes: 'Paid bill INV-2026-001',
      },
    });

    const realizedTargetExpense = await prisma.expense.create({
      data: {
        walletId: sourceWallet.id,
        userId: memberUser.id,
        categoryId: foodCat.id,
        title: 'Bulk Organic Coffee',
        amount: 45.0,
        date: new Date('2026-03-18T14:30:00Z'),
      },
    });

    // Planned expenses: 1 PENDING, 1 REALIZED linked to realizedTargetExpense
    await prisma.plannedExpense.create({
      data: {
        walletId: sourceWallet.id,
        userId: ownerUser.id,
        categoryId: foodCat.id,
        title: 'Dinner Party Supplies',
        amount: 120.0,
        expectedDate: new Date('2026-03-25T00:00:00Z'),
        status: 'PENDING',
      },
    });

    await prisma.plannedExpense.create({
      data: {
        walletId: sourceWallet.id,
        userId: memberUser.id,
        categoryId: foodCat.id,
        title: 'Bulk Organic Coffee',
        amount: 45.0,
        expectedDate: new Date('2026-03-18T00:00:00Z'),
        status: 'REALIZED',
        realizedExpenseId: realizedTargetExpense.id,
      },
    });

    // Activity logs: create 12 logs to ensure ALL rows are exported (> 10)
    for (let i = 1; i <= 12; i++) {
      await prisma.activityLog.create({
        data: {
          walletId: sourceWallet.id,
          userId: i % 2 === 0 ? memberUser.id : ownerUser.id,
          action: `LOG_ENTRY_${i}`,
          details: `Activity record #${i}`,
          timestamp: new Date(Date.now() - (13 - i) * 60000),
        },
      });
    }

    // Call export route as member
    const exportReq = new NextRequest(`http://localhost:3000/api/wallets/${sourceWallet.id}/export`, {
      headers: {
        'x-user-id': memberUser.id,
        'x-auth-mode': 'mock',
      },
    });
    const exportRes = await exportRoute(exportReq, { params: Promise.resolve({ id: sourceWallet.id }) });
    assert.equal(exportRes.status, 200, 'Export route must return 200 for member');
    const exportJson = await exportRes.json();

    assert.equal(exportJson.version, '2.2', 'Export version must be 2.2 (additive month bonuses)');
    assert.equal(exportJson.categories.length, 2, 'Categories count should match');
    assert.equal(exportJson.expenses.length, 3, 'Expenses count should match');
    assert.equal(exportJson.invoices.length, 3, 'Invoices count should match');
    assert.equal(exportJson.plannedExpenses.length, 2, 'All planned expenses (any status) must be exported');
    assert.equal(exportJson.activityLogs.length, 12, 'All 12 activity logs must be exported');

    // Check refs and attribution
    for (const exp of exportJson.expenses) {
      assert.ok(exp.ref, 'Expense must have ref');
      assert.ok(exp.createdAt, 'Expense must have createdAt');
      assert.ok(exp.userName, 'Expense must have userName');
      assert.ok(exp.userEmail, 'Expense must have userEmail');
    }

    const exportedPaidExp = exportJson.expenses.find((e: { title: string }) => e.title === 'Electricity Bill Q1');
    assert.ok(exportedPaidExp, 'Paid bill expense must exist in export');
    assert.equal(exportedPaidExp.invoiceRef, paidBill.id, 'invoiceRef on expense must point to the bill id');

    const exportedPaidBill = exportJson.invoices.find((i: { title: string }) => i.title === 'Electricity Bill Q1');
    assert.ok(exportedPaidBill, 'Paid bill must exist in export');
    assert.equal(exportedPaidBill.status, 'PAID');
    assert.ok(exportedPaidBill.paidBy, 'Paid bill must have paidBy');
    assert.equal(exportedPaidBill.paidBy.email, memberUser.email);

    const exportedRealizedPlanned = exportJson.plannedExpenses.find((p: { title: string }) => p.title === 'Bulk Organic Coffee');
    assert.ok(exportedRealizedPlanned, 'Realized planned expense must exist in export');
    assert.equal(exportedRealizedPlanned.status, 'REALIZED');
    assert.equal(exportedRealizedPlanned.realizedExpenseRef, realizedTargetExpense.id);

    console.log('✓ Test 1 Passed: v2.0 export verified with all entities, links, statuses, and full history.');

    // ------------------------------------------------------------------------
    // Test 2: Full-Fidelity Import into a New Wallet
    // ------------------------------------------------------------------------
    console.log('--- Test 2: Full-Fidelity Import into a New Wallet ---');
    const targetWallet = await prisma.wallet.create({
      data: {
        name: `Target Wallet ${timestamp}`,
        currency: 'EUR',
        monthlyBudget: 2000,
        members: {
          create: [
            { userId: ownerUser.id, role: 'OWNER' },
            { userId: memberUser.id, role: 'MEMBER' },
          ],
        },
      },
    });
    createdWalletIds.push(targetWallet.id);

    const importReq = new NextRequest(`http://localhost:3000/api/wallets/${targetWallet.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
        'x-auth-mode': 'mock',
      },
      body: JSON.stringify(exportJson),
    });
    const importRes = await importRoute(importReq, { params: Promise.resolve({ id: targetWallet.id }) });
    assert.equal(importRes.status, 200, 'Import route must return 200');
    const importJson = await importRes.json();
    assert.equal(importJson.success, true);
    assert.equal(importJson.imported.categories, 2);
    assert.equal(importJson.imported.expenses, 3);
    assert.equal(importJson.imported.invoices, 3);
    assert.equal(importJson.imported.plannedExpenses, 2);
    assert.equal(importJson.imported.history, 12);

    // Verify DB state in target wallet
    const importedCategories = await prisma.category.findMany({ where: { walletId: targetWallet.id } });
    const importedExpenses = await prisma.expense.findMany({ where: { walletId: targetWallet.id } });
    const importedInvoices = await prisma.invoiceBill.findMany({ where: { walletId: targetWallet.id } });
    const importedPlanned = await prisma.plannedExpense.findMany({ where: { walletId: targetWallet.id } });
    const importedLogs = await prisma.activityLog.findMany({ where: { walletId: targetWallet.id }, orderBy: { timestamp: 'asc' } });

    assert.equal(importedCategories.length, 2);
    assert.equal(importedExpenses.length, 3);
    assert.equal(importedInvoices.length, 3);
    assert.equal(importedPlanned.length, 2);
    // 12 imported logs + 1 DATA_IMPORTED log = 13
    assert.equal(importedLogs.length, 13);
    assert.equal(importedLogs[importedLogs.length - 1].action, 'DATA_IMPORTED');

    // Totals comparison
    const sourceExpenseTotal = [regularExpense, billLinkedExpense, realizedTargetExpense].reduce((s, e) => s + e.amount, 0);
    const targetExpenseTotal = importedExpenses.reduce((s, e) => s + e.amount, 0);
    assert.equal(targetExpenseTotal.toFixed(2), sourceExpenseTotal.toFixed(2), 'Expense totals must match');

    // Link integrity: paid bill expense must point to imported paid bill
    const targetPaidBill = importedInvoices.find((i) => i.title === 'Electricity Bill Q1');
    assert.ok(targetPaidBill, 'Target must have Electricity Bill Q1');
    assert.equal(targetPaidBill.status, 'PAID');
    assert.equal(targetPaidBill.paidByUserId, memberUser.id, 'paidByUserId must resolve to memberUser');

    const targetPaidExp = importedExpenses.find((e) => e.title === 'Electricity Bill Q1');
    assert.ok(targetPaidExp, 'Target must have Electricity Bill Q1 expense');
    assert.equal(targetPaidExp.invoiceId, targetPaidBill.id, 'Imported expense invoiceId must match target bill id');

    // Paying the bill again should create NO second Expense (pay route deduplication check)
    const payReq = new NextRequest(`http://localhost:3000/api/invoices/${targetPaidBill.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
        'x-auth-mode': 'mock',
      },
      body: JSON.stringify({ paidDate: '2026-03-14' }),
    });
    const payRes = await payInvoiceRoute(payReq, { params: Promise.resolve({ id: targetPaidBill.id }) });
    assert.equal(payRes.status, 200, 'Paying already paid bill returns 200');
    const expensesAfterPay = await prisma.expense.findMany({
      where: { walletId: targetWallet.id, invoiceId: targetPaidBill.id },
    });
    assert.equal(expensesAfterPay.length, 1, 'Paying bill again must NOT create a duplicate expense');

    // Link integrity: REALIZED planned expense must point to realized expense
    const targetRealizedExp = importedExpenses.find((e) => e.title === 'Bulk Organic Coffee');
    const targetRealizedPlanned = importedPlanned.find((p) => p.title === 'Bulk Organic Coffee');
    assert.ok(targetRealizedExp && targetRealizedPlanned);
    assert.equal(targetRealizedPlanned.status, 'REALIZED');
    assert.equal(targetRealizedPlanned.realizedExpenseId, targetRealizedExp.id);

    const targetPendingPlanned = importedPlanned.find((p) => p.title === 'Dinner Party Supplies');
    assert.ok(targetPendingPlanned);
    assert.equal(targetPendingPlanned.status, 'PENDING');
    assert.equal(targetPendingPlanned.realizedExpenseId, null);

    console.log('✓ Test 2 Passed: Full roundtrip fidelity, link re-mapping, dedupe protection, and history verified.');

    // ------------------------------------------------------------------------
    // Test 3: Backward Compatibility (v1.0 format and partial files)
    // ------------------------------------------------------------------------
    console.log('--- Test 3: Backward Compatibility (v1.0 format and partial files) ---');
    const v1Payload = {
      version: '1.0',
      wallet: { name: 'Old Format Wallet', currency: 'EUR' },
      categories: [{ name: 'Legacy Cat', icon: 'Tag', color: '#3b82f6', monthlyLimit: 100 }],
      expenses: [{ title: 'Old Expense', amount: 33.5, date: '2026-01-10T00:00:00Z', categoryName: 'Legacy Cat' }],
      invoices: [{ title: 'Old Bill', amount: 50, type: 'BILL', dueDate: '2026-01-20T00:00:00Z', status: 'PENDING' }],
      plannedExpenses: [{ title: 'Old Planned', amount: 60, expectedDate: '2026-01-25T00:00:00Z', category: 'Legacy Cat' }],
    };

    const v1TargetWallet = await prisma.wallet.create({
      data: {
        name: `V1 Target ${timestamp}`,
        members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] },
      },
    });
    createdWalletIds.push(v1TargetWallet.id);

    const v1Req = new NextRequest(`http://localhost:3000/api/wallets/${v1TargetWallet.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
        'x-auth-mode': 'mock',
      },
      body: JSON.stringify(v1Payload),
    });
    const v1Res = await importRoute(v1Req, { params: Promise.resolve({ id: v1TargetWallet.id }) });
    assert.equal(v1Res.status, 200, 'v1.0 payload must import cleanly');
    const v1Result = await v1Res.json();
    assert.equal(v1Result.imported.categories, 1);
    assert.equal(v1Result.imported.expenses, 1);
    assert.equal(v1Result.imported.invoices, 1);
    assert.equal(v1Result.imported.plannedExpenses, 1);

    // Partial file test (only expenses)
    const partialReq = new NextRequest(`http://localhost:3000/api/wallets/${v1TargetWallet.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
        'x-auth-mode': 'mock',
      },
      body: JSON.stringify({
        expenses: [{ title: 'Standalone Expense', amount: 12.0 }],
      }),
    });
    const partialRes = await importRoute(partialReq, { params: Promise.resolve({ id: v1TargetWallet.id }) });
    assert.equal(partialRes.status, 200, 'Partial file with only expenses must import');

    console.log('✓ Test 3 Passed: v1.0 payload and partial payloads imported without errors.');

    // ------------------------------------------------------------------------
    // Test 4: Malformed Data Tolerance
    // ------------------------------------------------------------------------
    console.log('--- Test 4: Malformed Data Tolerance ---');
    const malformedPayload = {
      expenses: [
        { title: '', amount: 10 }, // missing title
        { title: 'Invalid Amount', amount: 'not-a-number' }, // bad amount
        { title: 'Bad Date', amount: 20, date: 'not-a-date' }, // valid title & amount, bad date string
        { title: 'Dangling Invoice Ref', amount: 30, invoiceRef: 'non-existent-invoice-id' }, // dangling ref
      ],
      invoices: [
        { title: 'Bad Due Date', amount: 50, dueDate: 'invalid-date' }, // bad date
        { title: 'Invalid Status Bill', amount: 60, dueDate: '2026-05-01T00:00:00Z', status: 'INVALID_STATUS_XYZ' }, // bad status
      ],
      plannedExpenses: [
        { title: 'Negative Amount', amount: -50, expectedDate: '2026-05-01T00:00:00Z' }, // negative amount
        { title: 'Dangling Realized Ref', amount: 75, expectedDate: '2026-05-01T00:00:00Z', status: 'REALIZED', realizedExpenseRef: 'no-such-expense' },
      ],
      activityLogs: [
        null,
        'not-an-object',
        { action: 'VALID_ACTION', details: 'Valid log', timestamp: 'not-a-date' },
      ],
    };

    const malformedReq = new NextRequest(`http://localhost:3000/api/wallets/${v1TargetWallet.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
        'x-auth-mode': 'mock',
      },
      body: JSON.stringify(malformedPayload),
    });
    const malformedRes = await importRoute(malformedReq, { params: Promise.resolve({ id: v1TargetWallet.id }) });
    assert.equal(malformedRes.status, 200, 'Malformed rows must be skipped/normalized, never return 500');
    const malformedResult = await malformedRes.json();
    assert.equal(malformedResult.success, true);
    // Bad Date and Dangling Invoice Ref expenses should be imported safely
    assert.equal(malformedResult.imported.expenses, 2);
    // Invalid Status Bill should have normalized status to PENDING
    assert.equal(malformedResult.imported.invoices, 1);
    // Dangling Realized Ref planned expense should import safely with realizedExpenseId: null
    assert.equal(malformedResult.imported.plannedExpenses, 1);
    // Valid log with bad date string should fallback to now
    assert.equal(malformedResult.imported.history, 1);

    console.log('✓ Test 4 Passed: Malformed entries safely skipped or normalized without 500.');

    // ------------------------------------------------------------------------
    // Test 5: Authorization & Roles
    // ------------------------------------------------------------------------
    console.log('--- Test 5: Authorization & Roles ---');
    // Unauthenticated
    const unauthReq = new NextRequest(`http://localhost:3000/api/wallets/${sourceWallet.id}/export`, {
      headers: { 'x-auth-mode': 'normal' },
    });
    const unauthRes = await exportRoute(unauthReq, { params: Promise.resolve({ id: sourceWallet.id }) });
    assert.equal(unauthRes.status, 401, 'Unauthenticated export must return 401');

    // Outsider export
    const outsiderReq = new NextRequest(`http://localhost:3000/api/wallets/${sourceWallet.id}/export`, {
      headers: { 'x-user-id': outsiderUser.id, 'x-auth-mode': 'mock' },
    });
    const outsiderRes = await exportRoute(outsiderReq, { params: Promise.resolve({ id: sourceWallet.id }) });
    assert.equal(outsiderRes.status, 403, 'Non-member export must return 403');

    // Viewer export (any member can export)
    const viewerReq = new NextRequest(`http://localhost:3000/api/wallets/${sourceWallet.id}/export`, {
      headers: { 'x-user-id': viewerUser.id, 'x-auth-mode': 'mock' },
    });
    const viewerRes = await exportRoute(viewerReq, { params: Promise.resolve({ id: sourceWallet.id }) });
    assert.equal(viewerRes.status, 200, 'VIEWER member can export');

    // Viewer import (VIEWER cannot import, only OWNER or MEMBER)
    const viewerImportReq = new NextRequest(`http://localhost:3000/api/wallets/${sourceWallet.id}/import`, {
      method: 'POST',
      headers: { 'x-user-id': viewerUser.id, 'x-auth-mode': 'mock' },
      body: JSON.stringify({ expenses: [{ title: 'Disallowed', amount: 10 }] }),
    });
    const viewerImportRes = await importRoute(viewerImportReq, { params: Promise.resolve({ id: sourceWallet.id }) });
    assert.equal(viewerImportRes.status, 403, 'VIEWER member import must return 403 Forbidden');

    console.log('✓ Test 5 Passed: Security, authentication, and role checks verified.');

    // ------------------------------------------------------------------------
    // Test 6: Transaction Atomicity & Rollback Verification
    // ------------------------------------------------------------------------
    console.log('--- Test 6: Transaction Atomicity & Rollback Verification ---');
    const rollbackWallet = await prisma.wallet.create({
      data: {
        name: `Rollback Wallet ${timestamp}`,
        members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] },
      },
    });
    createdWalletIds.push(rollbackWallet.id);

    // Monkeypatch prisma.$transaction in this test process to simulate a genuine mid-transaction failure
    const origTransaction = prisma.$transaction;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.$transaction = function (this: any, arg: any, ...rest: any[]) {
      if (typeof arg === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return origTransaction.call(this, async (tx: any) => {
          // Intercept tx.plannedExpense.create after categories, invoices, and expenses were already created in tx
          tx.plannedExpense.create = async () => {
            throw new Error('Simulated database failure during plannedExpense.create mid-transaction');
          };
          return arg(tx);
        }, rest[0]);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origTransaction as any).call(this, arg, ...rest);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    let rollbackResStatus = 0;
    try {
      const rollbackReq = new NextRequest(`http://localhost:3000/api/wallets/${rollbackWallet.id}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': ownerUser.id,
          'x-auth-mode': 'mock',
        },
        body: JSON.stringify({
          categories: [{ name: 'Rollback Cat' }],
          expenses: [{ title: 'Rollback Exp', amount: 50 }],
          invoices: [{ title: 'Rollback Bill', amount: 75, dueDate: '2026-06-01T00:00:00Z' }],
          plannedExpenses: [{ title: 'Rollback Planned', amount: 100, expectedDate: '2026-06-15T00:00:00Z' }],
        }),
      });
      const rollbackRes = await importRoute(rollbackReq, { params: Promise.resolve({ id: rollbackWallet.id }) });
      rollbackResStatus = rollbackRes.status;
    } finally {
      // Always restore original transaction method immediately
      prisma.$transaction = origTransaction;
    }

    assert.equal(rollbackResStatus, 500, 'Mid-transaction failure must return 500');

    // Confirm that 0 rows were inserted into rollbackWallet
    const rbCats = await prisma.category.count({ where: { walletId: rollbackWallet.id } });
    const rbExps = await prisma.expense.count({ where: { walletId: rollbackWallet.id } });
    const rbInvs = await prisma.invoiceBill.count({ where: { walletId: rollbackWallet.id } });
    const rbPlans = await prisma.plannedExpense.count({ where: { walletId: rollbackWallet.id } });
    const rbLogs = await prisma.activityLog.count({ where: { walletId: rollbackWallet.id } });

    assert.equal(rbCats, 0, 'No categories must remain after rollback');
    assert.equal(rbExps, 0, 'No expenses must remain after rollback');
    assert.equal(rbInvs, 0, 'No invoices must remain after rollback');
    assert.equal(rbPlans, 0, 'No planned expenses must remain after rollback');
    assert.equal(rbLogs, 0, 'No activity logs must remain after rollback');

    console.log('✓ Test 6 Passed: Atomic interactive transaction rolled back all rows cleanly on failure.');

    // ------------------------------------------------------------------------
    // Test 7: Large Wallet Import Scale Test (2,000 expenses + 500 bills)
    // ------------------------------------------------------------------------
    console.log('--- Test 7: Large Wallet Import Scale Test (2,000 expenses + 500 bills) ---');
    const scaleWallet = await prisma.wallet.create({
      data: {
        name: `Scale Wallet ${timestamp}`,
        members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] },
      },
    });
    createdWalletIds.push(scaleWallet.id);

    const bulkExpenses: Array<{ title: string; amount: number; date: string }> = [];
    for (let i = 0; i < 2000; i++) {
      bulkExpenses.push({
        title: `Bulk Expense #${i + 1}`,
        amount: 10 + (i % 50),
        date: '2026-03-01T00:00:00Z',
      });
    }

    const bulkInvoices: Array<{ title: string; amount: number; dueDate: string; type: string }> = [];
    for (let i = 0; i < 500; i++) {
      bulkInvoices.push({
        title: `Bulk Bill #${i + 1}`,
        amount: 25 + (i % 100),
        dueDate: '2026-03-15T00:00:00Z',
        type: i % 10 === 0 ? 'SUBSCRIPTION' : 'BILL',
      });
    }

    const startTime = Date.now();
    const scaleReq = new NextRequest(`http://localhost:3000/api/wallets/${scaleWallet.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
        'x-auth-mode': 'mock',
      },
      body: JSON.stringify({
        expenses: bulkExpenses,
        invoices: bulkInvoices,
      }),
    });
    const scaleRes = await importRoute(scaleReq, { params: Promise.resolve({ id: scaleWallet.id }) });
    const durationMs = Date.now() - startTime;
    assert.equal(scaleRes.status, 200, 'Bulk import of 2,500 items must return 200 without timeout');
    const scaleResult = await scaleRes.json();
    assert.equal(scaleResult.imported.expenses, 2000);
    assert.equal(scaleResult.imported.invoices, 500);

    const totalScaleExpenses = await prisma.expense.count({ where: { walletId: scaleWallet.id } });
    const totalScaleInvoices = await prisma.invoiceBill.count({ where: { walletId: scaleWallet.id } });
    assert.equal(totalScaleExpenses, 2000);
    assert.equal(totalScaleInvoices, 500);

    console.log(`✓ Test 7 Passed: 2,000 expenses and 500 bills imported successfully in ${durationMs}ms (no timeout).`);

    // ------------------------------------------------------------------------
    // Test 8: Savings roundtrip (buckets, links, ledger, funded expenses) + import invariants
    // ------------------------------------------------------------------------
    console.log('--- Test 8: Savings roundtrip ---');
    const now = new Date();
    const inMonths = (k: number) => new Date(now.getFullYear(), now.getMonth() + k, 15, 12);
    const savSource = await prisma.wallet.create({
      data: { name: `Savings Source ${timestamp}`, members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] } },
    });
    createdWalletIds.push(savSource.id);
    const w = savSource.id;
    const u = ownerUser.id;
    const general = await prisma.savingsBucket.create({ data: { walletId: w, kind: 'GENERAL', name: 'General savings' } });
    const car = await prisma.savingsBucket.create({ data: { walletId: w, name: 'Car', color: '#6366f1' } });
    const phone = await prisma.savingsBucket.create({ data: { walletId: w, name: 'Phone', status: 'CLOSED', closedAt: now } });
    await prisma.plannedExpense.create({
      data: { walletId: w, userId: u, title: 'Car down payment', amount: 1200, expectedDate: inMonths(6), savingsBucketId: car.id },
    });
    const phoneExpense = await prisma.expense.create({
      data: { walletId: w, userId: u, title: 'Phone', amount: 500, savingsFundedAmount: 400, date: now },
    });
    await prisma.plannedExpense.create({
      data: {
        walletId: w, userId: u, title: 'Phone', amount: 500, expectedDate: now, status: 'REALIZED',
        realizedExpenseId: phoneExpense.id, savingsBucketId: phone.id,
      },
    });
    const tx = (bucketId: string, type: string, amount: number, extra: Record<string, unknown> = {}) =>
      prisma.savingsTransaction.create({ data: { walletId: w, bucketId, userId: u, type, amount, date: now, ...extra } });
    await tx(general.id, 'DEPOSIT', 100);
    await tx(general.id, 'ADJUSTMENT_IN', 10, { note: 'gift' });
    await tx(general.id, 'BUDGET_BOOST', -20);
    await tx(car.id, 'DEPOSIT', 300);
    await tx(car.id, 'TRANSFER_OUT', -50, { transferGroupId: 'g1' });
    await tx(general.id, 'TRANSFER_IN', 50, { transferGroupId: 'g1' });
    await tx(phone.id, 'DEPOSIT', 400);
    await tx(phone.id, 'EXPENSE_DRAW', -400, { expenseId: phoneExpense.id });

    const savExportRes = await exportRoute(
      new NextRequest(`http://localhost:3000/api/wallets/${w}/export`, { headers: { 'x-user-id': u, 'x-auth-mode': 'mock' } }),
      { params: Promise.resolve({ id: w }) }
    );
    const savExport = await savExportRes.json();
    assert.equal(savExport.savingsBuckets.length, 3);
    assert.equal(savExport.savingsTransactions.length, 8);
    assert.equal(savExport.plannedExpenses.find((p: { title: string }) => p.title === 'Car down payment').savingsBucketRef, car.id);

    const savTarget = await prisma.wallet.create({
      data: { name: `Savings Target ${timestamp}`, members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] } },
    });
    createdWalletIds.push(savTarget.id);
    const importSavings = (walletId: string, payload: unknown) =>
      importRoute(
        new NextRequest(`http://localhost:3000/api/wallets/${walletId}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': u, 'x-auth-mode': 'mock' },
          body: JSON.stringify(payload),
        }),
        { params: Promise.resolve({ id: walletId }) }
      );
    const savImportRes = await importSavings(savTarget.id, savExport);
    assert.equal(savImportRes.status, 200);
    const savImportJson = await savImportRes.json();
    assert.equal(savImportJson.imported.savingsBuckets, 2, 'two sub-buckets (General merged)');
    assert.equal(savImportJson.imported.savingsTransactions, 8);

    const summarize = async (walletId: string) => {
      const { buckets, inputs } = await loadSavingsInputs(prisma, walletId);
      const month = computeSavingsMonth(inputs, getCurrentMonthKey(now), now);
      return {
        buckets: buckets
          .map((b, i) => ({ kind: b.kind, name: b.name, status: b.status, balance: month.buckets[i].balanceNow, pending: b.plannedExpenses.length }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        deposited: month.deposited,
        boost: month.boost,
        savingsDue: month.savingsDue,
        funded: (await prisma.expense.findMany({ where: { walletId }, select: { title: true, savingsFundedAmount: true } }))
          .map((e) => `${e.title}:${e.savingsFundedAmount}`)
          .sort(),
      };
    };
    assert.deepEqual(await summarize(savTarget.id), await summarize(w), 'balances, statuses, links, budget effect identical');
    const pairs = await prisma.savingsTransaction.groupBy({
      by: ['transferGroupId'],
      where: { walletId: savTarget.id, transferGroupId: { not: null } },
      _sum: { amount: true },
    });
    assert.equal(pairs.length, 1);
    assert.notEqual(pairs[0].transferGroupId, 'g1', 'transfer group ids are regenerated');
    assert.equal(pairs[0]._sum.amount, 0);

    // ACTIVE bucket without a pending expense in the file → closed on import, money to General
    const orphanTarget = await prisma.wallet.create({
      data: { name: `Savings Orphan ${timestamp}`, members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] } },
    });
    createdWalletIds.push(orphanTarget.id);
    const orphanRes = await importSavings(orphanTarget.id, {
      version: '2.1',
      savingsBuckets: [{ ref: 'b1', kind: 'GOAL', name: 'Orphan', status: 'ACTIVE' }],
      savingsTransactions: [{ ref: 't1', bucketRef: 'b1', type: 'DEPOSIT', amount: 75, date: now.toISOString() }],
    });
    assert.equal(orphanRes.status, 200);
    const orphanSummary = await summarize(orphanTarget.id);
    assert.deepEqual(
      orphanSummary.buckets.map((b) => [b.kind, b.status, b.balance]),
      [['GENERAL', 'ACTIVE', 75], ['GOAL', 'CLOSED', 0]],
      'orphan bucket closed, its €75 moved to General'
    );

    // Inconsistent ledger (money out of a bucket that never had any) → 400, nothing written
    const badTarget = await prisma.wallet.create({
      data: { name: `Savings Bad ${timestamp}`, members: { create: [{ userId: ownerUser.id, role: 'OWNER' }] } },
    });
    createdWalletIds.push(badTarget.id);
    const badRes = await importSavings(badTarget.id, {
      version: '2.1',
      expenses: [{ title: 'Should roll back', amount: 5 }],
      savingsBuckets: [{ ref: 'g', kind: 'GENERAL', name: 'General savings' }],
      savingsTransactions: [
        { bucketRef: 'g', type: 'BUDGET_BOOST', amount: -40, date: now.toISOString() },
        { bucketRef: 'missing', type: 'DEPOSIT', amount: 10, date: now.toISOString() },
        { bucketRef: 'g', type: 'NOT_A_TYPE', amount: 10, date: now.toISOString() },
      ],
    });
    assert.equal(badRes.status, 400);
    assert.equal(await prisma.expense.count({ where: { walletId: badTarget.id } }), 0, 'atomic rollback');
    assert.equal(await prisma.savingsTransaction.count({ where: { walletId: badTarget.id } }), 0);

    console.log('✓ Test 8 Passed: savings buckets, links, ledger and funded expenses roundtrip identically; invariants enforced on import.');

    console.log('\n🎉 ALL 8 ROUNDTRIP & FIDELITY TEST CASES PASSED SUCCESSFULLY!\n');
  } finally {
    // ------------------------------------------------------------------------
    // Cleanup all throwaway test entities
    // ------------------------------------------------------------------------
    console.log('Cleaning up throwaway test wallets and users...');
    for (const wid of createdWalletIds) {
      await prisma.activityLog.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.plannedExpense.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.invoiceBill.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.category.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.walletInvite.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.walletMember.deleteMany({ where: { walletId: wid } }).catch(() => {});
      await prisma.wallet.delete({ where: { id: wid } }).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await prisma.walletMember.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.activityLog.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    console.log('✓ Cleanup complete. Zero throwaway data left in DB.\n');
  }
}

run().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
