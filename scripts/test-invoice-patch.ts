import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';

async function main() {
  const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
  console.log(`Connecting to server at ${BASE_URL}...`);

  // Verify server is reachable
  try {
    const probe = await fetch(`${BASE_URL}/api/users`, { signal: AbortSignal.timeout(3000) });
    if (!probe.ok && probe.status !== 401) {
      console.error(`Server returned status ${probe.status}`);
      process.exit(1);
    }
  } catch {
    console.error(`Server at ${BASE_URL} is unreachable. Please ensure the dev server is running on :3000.`);
    process.exit(1);
  }

  // Find wallet named 'Household & Living' with its OWNER member
  const wallet = await prisma.wallet.findFirst({
    where: { name: 'Household & Living' },
    include: {
      members: {
        where: { role: 'OWNER' },
        include: { user: true },
      },
      categories: true,
    },
  });

  if (!wallet || wallet.members.length === 0) {
    console.error('Wallet "Household & Living" or its OWNER member not found. Skipping.');
    process.exit(1);
  }

  const ownerUser = wallet.members[0].user;
  console.log(`Found wallet "${wallet.name}" with OWNER "${ownerUser.name}" (${ownerUser.id})`);

  // Find category from another wallet
  const otherCategory = await prisma.category.findFirst({
    where: { walletId: { not: wallet.id } },
  });
  if (!otherCategory) {
    console.error('No category from another wallet found for cross-wallet validation test.');
    process.exit(1);
  }

  const initialExpenseCount = await prisma.expense.count({
    where: { walletId: wallet.id },
  });

  let tempViewerUser: { id: string } | null = null;
  let tempViewerMember: { id: string } | null = null;
  let tempInvoice: { id: string } | null = null;

  try {
    // Create temporary VIEWER user + membership
    tempViewerUser = await prisma.user.create({
      data: {
        name: `Temp Viewer ${Date.now()}`,
        email: `temp-viewer-${Date.now()}@example.com`,
      },
    });

    tempViewerMember = await prisma.walletMember.create({
      data: {
        walletId: wallet.id,
        userId: tempViewerUser.id,
        role: 'VIEWER',
      },
    });

    // Create temporary invoice in that wallet
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);

    tempInvoice = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        title: 'Temporary Test Bill',
        amount: 75.0,
        type: 'BILL',
        dueDate: futureDate,
        status: 'PENDING',
        isRecurring: false,
        recurrenceInterval: 'NONE',
        reminderDaysBefore: 3,
      },
    });

    console.log(`Created temporary invoice: ${tempInvoice.id}`);

    // 1. OWNER PATCH title+amount -> 200 and fields changed
    console.log('1. Testing OWNER PATCH title+amount -> 200...');
    const res1 = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        title: 'Updated Temporary Bill Title',
        amount: 88.5,
      }),
    });
    assert.equal(res1.status, 200, `Expected 200 on owner PATCH, got ${res1.status}`);
    const data1 = await res1.json();
    assert.equal(data1.invoice.title, 'Updated Temporary Bill Title');
    assert.equal(data1.invoice.amount, 88.5);
    console.log('   ✓ Title and amount successfully updated');

    // 2. PATCH a past dueDate on a PENDING row -> status OVERDUE, future -> PENDING
    console.log('2. Testing PATCH past dueDate -> OVERDUE, future dueDate -> PENDING...');
    const pastDueDate = new Date('2020-01-15T00:00:00.000Z').toISOString();
    const res2Past = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        dueDate: pastDueDate,
      }),
    });
    assert.equal(res2Past.status, 200, `Expected 200 for past dueDate PATCH, got ${res2Past.status}`);
    const data2Past = await res2Past.json();
    assert.equal(data2Past.invoice.status, 'OVERDUE', 'Expected status OVERDUE for past dueDate');

    const futureDueDate = new Date('2030-01-15T00:00:00.000Z').toISOString();
    const res2Future = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        dueDate: futureDueDate,
      }),
    });
    assert.equal(res2Future.status, 200, `Expected 200 for future dueDate PATCH, got ${res2Future.status}`);
    const data2Future = await res2Future.json();
    assert.equal(data2Future.invoice.status, 'PENDING', 'Expected status PENDING for future dueDate');
    console.log('   ✓ Status correctly recomputed for past and future dates');

    // 3. VIEWER PATCH -> 403
    console.log('3. Testing VIEWER PATCH -> 403...');
    const res3 = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempViewerUser.id,
      },
      body: JSON.stringify({
        title: 'Viewer Attempt',
      }),
    });
    assert.equal(res3.status, 403, `Expected 403 for VIEWER role, got ${res3.status}`);
    console.log('   ✓ VIEWER edit rejected with 403');

    // 4. unknown id -> 404
    console.log('4. Testing unknown id -> 404...');
    const res4 = await fetch(`${BASE_URL}/api/invoices/nonexistent-invoice-id-99999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        title: 'Unknown ID Test',
      }),
    });
    assert.equal(res4.status, 404, `Expected 404 for nonexistent id, got ${res4.status}`);
    console.log('   ✓ Nonexistent invoice rejected with 404');

    // 5. Skip 401 case as instructed (mock fallback returns default user)

    // 6. amount 'abc' -> 400
    console.log('6. Testing amount "abc" -> 400...');
    const res6 = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        amount: 'abc',
      }),
    });
    assert.equal(res6.status, 400, `Expected 400 for invalid amount "abc", got ${res6.status}`);
    console.log('   ✓ Invalid amount rejected with 400');

    // 7. categoryId of a category from ANOTHER wallet -> 400
    console.log('7. Testing categoryId from another wallet -> 400...');
    const res7 = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        categoryId: otherCategory.id,
      }),
    });
    assert.equal(res7.status, 400, `Expected 400 for category from another wallet, got ${res7.status}`);
    console.log('   ✓ Cross-wallet categoryId rejected with 400');

    // 8. PAID non-subscription row (set status PAID via prisma) PATCH amount -> 400 but PATCH notes -> 200
    console.log('8. Testing PAID non-subscription row locks...');
    await prisma.invoiceBill.update({
      where: { id: tempInvoice.id },
      data: { status: 'PAID' },
    });

    const res8Amount = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        amount: 250.0,
      }),
    });
    assert.equal(res8Amount.status, 400, `Expected 400 when changing amount on PAID bill, got ${res8Amount.status}`);
    const data8Amount = await res8Amount.json();
    assert.equal(data8Amount.error, 'Paid bills lock amount, due date and type');

    const res8Notes = await fetch(`${BASE_URL}/api/invoices/${tempInvoice.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        notes: 'Paid via direct bank transfer',
      }),
    });
    assert.equal(res8Notes.status, 200, `Expected 200 when updating notes on PAID bill, got ${res8Notes.status}`);
    const data8Notes = await res8Notes.json();
    assert.equal(data8Notes.invoice.notes, 'Paid via direct bank transfer');
    assert.equal(data8Notes.invoice.status, 'PAID');
    console.log('   ✓ PAID bill correctly rejected amount change (400) and accepted notes update (200)');

    // 9. no Expense rows created (count Expenses for the wallet before/after equals)
    console.log('9. Verifying no Expense rows created...');
    const finalExpenseCount = await prisma.expense.count({
      where: { walletId: wallet.id },
    });
    assert.equal(
      finalExpenseCount,
      initialExpenseCount,
      `Expected expense count to remain ${initialExpenseCount}, but got ${finalExpenseCount}`
    );
    console.log('   ✓ Expense row count unchanged (no Expense rows created)');

    console.log('\n✅ All test-invoice-patch assertions passed successfully!');
  } finally {
    console.log('\nCleaning up temporary test records...');
    if (tempInvoice) {
      await prisma.invoiceBill.deleteMany({ where: { id: tempInvoice.id } }).catch((err) =>
        console.error('Error deleting temp invoice:', err)
      );
    }
    if (tempViewerMember) {
      await prisma.walletMember.deleteMany({ where: { id: tempViewerMember.id } }).catch((err) =>
        console.error('Error deleting temp member:', err)
      );
    }
    if (tempViewerUser) {
      await prisma.activityLog.deleteMany({ where: { userId: tempViewerUser.id } }).catch((err) =>
        console.error('Error deleting temp user logs:', err)
      );
      await prisma.user.deleteMany({ where: { id: tempViewerUser.id } }).catch((err) =>
        console.error('Error deleting temp user:', err)
      );
    }
    // Clean up any activity logs created during test
    await prisma.activityLog.deleteMany({
      where: {
        walletId: wallet.id,
        details: { contains: 'Temporary Bill' },
      },
    }).catch((err) => console.error('Error deleting test activity logs:', err));

    await prisma.$disconnect();
    console.log('Cleanup completed.');
  }
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
