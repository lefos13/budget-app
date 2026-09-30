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

  // Find wallet named 'Household & Living' with its OWNER member and categories
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

  if (!wallet || wallet.members.length === 0 || wallet.categories.length === 0) {
    console.error('Wallet "Household & Living", its OWNER member, or categories not found. Skipping.');
    process.exit(1);
  }

  const ownerUser = wallet.members[0].user;
  console.log(`Found wallet "${wallet.name}" with OWNER "${ownerUser.name}" (${ownerUser.id})`);

  // Find category from another wallet for cross-wallet validation
  const otherCategory = await prisma.category.findFirst({
    where: { walletId: { not: wallet.id } },
  });
  if (!otherCategory) {
    console.error('No category from another wallet found for cross-wallet validation test.');
    process.exit(1);
  }

  // Record initial counts
  const initialCounts = {
    user: await prisma.user.count(),
    walletMember: await prisma.walletMember.count(),
    expense: await prisma.expense.count(),
    plannedExpense: await prisma.plannedExpense.count(),
  };

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let tempMemberUser: { id: string } | null = null;
  let tempViewerUser: { id: string } | null = null;
  let tempNonMemberUser: { id: string } | null = null;
  let tempMemberMembership: { id: string } | null = null;
  let tempViewerMembership: { id: string } | null = null;
  const createdExpenseIds: string[] = [];

  try {
    // Create temporary users: MEMBER, VIEWER, NON-MEMBER
    tempMemberUser = await prisma.user.create({
      data: {
        name: `Temp Member ${uniqueSuffix}`,
        email: `temp-member-${uniqueSuffix}@example.com`,
      },
    });

    tempMemberMembership = await prisma.walletMember.create({
      data: {
        walletId: wallet.id,
        userId: tempMemberUser.id,
        role: 'MEMBER',
      },
    });

    tempViewerUser = await prisma.user.create({
      data: {
        name: `Temp Viewer ${uniqueSuffix}`,
        email: `temp-viewer-${uniqueSuffix}@example.com`,
      },
    });

    tempViewerMembership = await prisma.walletMember.create({
      data: {
        walletId: wallet.id,
        userId: tempViewerUser.id,
        role: 'VIEWER',
      },
    });

    tempNonMemberUser = await prisma.user.create({
      data: {
        name: `Temp NonMember ${uniqueSuffix}`,
        email: `temp-nonmember-${uniqueSuffix}@example.com`,
      },
    });

    console.log('Created temporary users and memberships.');

    // 1. Create an expense by OWNER in 'Household & Living'
    console.log('1. Creating expense by OWNER...');
    const ownerExpense = await prisma.expense.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        title: `Owner Expense ${uniqueSuffix}`,
        amount: 50.0,
        date: new Date('2026-09-10T12:00:00.000Z'),
        categoryId: wallet.categories[0].id,
        notes: 'Initial owner notes',
        isRecurring: false,
      },
    });
    createdExpenseIds.push(ownerExpense.id);
    console.log(`   ✓ Expense created with ID: ${ownerExpense.id}`);

    // 2. MEMBER edits expense created by the OWNER -> 200 with changed title/amount/date/notes/category/isRecurring
    console.log('2. Testing MEMBER edits expense created by OWNER -> 200...');
    const targetCategory = wallet.categories.length > 1 ? wallet.categories[1] : wallet.categories[0];
    const editedTitle = `Member Edited ${uniqueSuffix}`;
    const resMemberEdit = await fetch(`${BASE_URL}/api/expenses/${ownerExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        title: editedTitle,
        amount: 88.5,
        date: '2026-09-20',
        categoryId: targetCategory.id,
        notes: 'Member updated notes',
        isRecurring: true,
      }),
    });
    assert.equal(resMemberEdit.status, 200, `Expected 200 on MEMBER edit, got ${resMemberEdit.status}`);
    const dataMemberEdit = await resMemberEdit.json();
    assert.ok(dataMemberEdit.expense, 'Expected expense in response');
    assert.equal(dataMemberEdit.expense.title, editedTitle);
    assert.equal(dataMemberEdit.expense.amount, 88.5);
    assert.equal(dataMemberEdit.expense.categoryId, targetCategory.id);
    assert.equal(dataMemberEdit.expense.notes, 'Member updated notes');
    assert.equal(dataMemberEdit.expense.isRecurring, true);
    assert.ok(dataMemberEdit.expense.category, 'Expected category included');
    assert.ok(dataMemberEdit.expense.user, 'Expected user included');

    // Verify DB state
    const dbExp1 = await prisma.expense.findUnique({ where: { id: ownerExpense.id } });
    assert.equal(dbExp1?.title, editedTitle);
    assert.equal(dbExp1?.amount, 88.5);
    assert.equal(dbExp1?.categoryId, targetCategory.id);
    assert.equal(dbExp1?.notes, 'Member updated notes');
    assert.equal(dbExp1?.isRecurring, true);
    assert.equal(dbExp1?.userId, ownerUser.id, 'userId must remain OWNER');
    assert.equal(dbExp1?.walletId, wallet.id, 'walletId must remain wallet.id');
    console.log('   ✓ MEMBER successfully edited OWNER expense');

    // 3. invoiceId in the body is ignored (unchanged in DB)
    console.log('3. Testing invoiceId in body is ignored...');
    const resInvoiceIdIgnore = await fetch(`${BASE_URL}/api/expenses/${ownerExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        invoiceId: 'malicious-or-unexpected-invoice-id',
      }),
    });
    assert.equal(resInvoiceIdIgnore.status, 200, `Expected 200 on PATCH with invoiceId, got ${resInvoiceIdIgnore.status}`);
    const dbExpInvoice = await prisma.expense.findUnique({ where: { id: ownerExpense.id } });
    assert.equal(dbExpInvoice?.invoiceId, null, 'invoiceId in DB must remain null and not be modified');
    console.log('   ✓ invoiceId was ignored and DB remains unchanged');

    // 4. Date moving across months as seen by GET /api/wallets/<id>?month=... metrics.totalSpentMonth
    console.log('4. Testing date change moves expense between months in metrics.totalSpentMonth...');
    // Initial totals for Sept and Oct
    const resSeptBefore = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resSeptBefore.status, 200);
    const dataSeptBefore = await resSeptBefore.json();
    const septTotalBefore = dataSeptBefore.metrics.totalSpentMonth;

    const resOctBefore = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-10`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resOctBefore.status, 200);
    const dataOctBefore = await resOctBefore.json();
    const octTotalBefore = dataOctBefore.metrics.totalSpentMonth;

    // Create temp expense 2026-09-15 amount 11.11
    const moveExpense = await prisma.expense.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        title: `Month Move Test ${uniqueSuffix}`,
        amount: 11.11,
        date: new Date('2026-09-15T00:00:00.000Z'),
      },
    });
    createdExpenseIds.push(moveExpense.id);

    // Check Sept total includes it and Oct doesn't
    const resSeptWith11 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    const dataSeptWith11 = await resSeptWith11.json();
    assert.ok(
      Math.abs(dataSeptWith11.metrics.totalSpentMonth - (septTotalBefore + 11.11)) < 0.01,
      `Expected Sept total ~${septTotalBefore + 11.11}, got ${dataSeptWith11.metrics.totalSpentMonth}`
    );

    const resOctWithout11 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-10`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    const dataOctWithout11 = await resOctWithout11.json();
    assert.ok(
      Math.abs(dataOctWithout11.metrics.totalSpentMonth - octTotalBefore) < 0.01,
      `Expected Oct total to remain ${octTotalBefore}, got ${dataOctWithout11.metrics.totalSpentMonth}`
    );

    // PATCH date to 2026-10-15
    const resPatchOct = await fetch(`${BASE_URL}/api/expenses/${moveExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        date: '2026-10-15',
      }),
    });
    assert.equal(resPatchOct.status, 200, `Expected 200 on date PATCH to Oct, got ${resPatchOct.status}`);

    // Verify Sept total no longer includes it, Oct total now includes it
    const resSeptAfterMove = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    const dataSeptAfterMove = await resSeptAfterMove.json();
    assert.ok(
      Math.abs(dataSeptAfterMove.metrics.totalSpentMonth - septTotalBefore) < 0.01,
      `Expected Sept total back to ${septTotalBefore}, got ${dataSeptAfterMove.metrics.totalSpentMonth}`
    );

    const resOctAfterMove = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-10`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    const dataOctAfterMove = await resOctAfterMove.json();
    assert.ok(
      Math.abs(dataOctAfterMove.metrics.totalSpentMonth - (octTotalBefore + 11.11)) < 0.01,
      `Expected Oct total ~${octTotalBefore + 11.11}, got ${dataOctAfterMove.metrics.totalSpentMonth}`
    );

    // Then reversed: PATCH date back to 2026-09-15
    const resPatchSept = await fetch(`${BASE_URL}/api/expenses/${moveExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        date: '2026-09-15',
      }),
    });
    assert.equal(resPatchSept.status, 200, `Expected 200 on reversed date PATCH, got ${resPatchSept.status}`);

    const resSeptReversed = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    const dataSeptReversed = await resSeptReversed.json();
    assert.ok(
      Math.abs(dataSeptReversed.metrics.totalSpentMonth - (septTotalBefore + 11.11)) < 0.01,
      `Expected Sept total ~${septTotalBefore + 11.11} after reversal, got ${dataSeptReversed.metrics.totalSpentMonth}`
    );

    const resOctReversed = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-10`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    const dataOctReversed = await resOctReversed.json();
    assert.ok(
      Math.abs(dataOctReversed.metrics.totalSpentMonth - octTotalBefore) < 0.01,
      `Expected Oct total back to ${octTotalBefore} after reversal, got ${dataOctReversed.metrics.totalSpentMonth}`
    );
    console.log('   ✓ Month total movements verified back and forth');

    // 5. VIEWER -> 403
    console.log('5. Testing VIEWER -> 403...');
    const resViewer = await fetch(`${BASE_URL}/api/expenses/${ownerExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempViewerUser.id,
      },
      body: JSON.stringify({ title: 'Viewer Attempt' }),
    });
    assert.equal(resViewer.status, 403, `Expected 403 for VIEWER, got ${resViewer.status}`);
    console.log('   ✓ VIEWER correctly rejected with 403');

    // 6. NON-MEMBER -> 403
    console.log('6. Testing NON-MEMBER -> 403...');
    const resNonMember = await fetch(`${BASE_URL}/api/expenses/${ownerExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempNonMemberUser.id,
      },
      body: JSON.stringify({ title: 'NonMember Attempt' }),
    });
    assert.equal(resNonMember.status, 403, `Expected 403 for NON-MEMBER, got ${resNonMember.status}`);
    console.log('   ✓ NON-MEMBER correctly rejected with 403');

    // 7. Unknown id -> 404
    console.log('7. Testing unknown id -> 404...');
    const resNotFound = await fetch(`${BASE_URL}/api/expenses/non-existent-cuid-12345`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({ title: 'Should Not Exist' }),
    });
    assert.equal(resNotFound.status, 404, `Expected 404 for unknown id, got ${resNotFound.status}`);
    console.log('   ✓ Unknown id correctly returned 404');

    // 8. Amount 0/'abc' and other validations -> 400
    console.log('8. Testing invalid inputs -> 400...');
    const invalidInputs = [
      { name: 'amount 0', body: { amount: 0 } },
      { name: 'negative amount', body: { amount: -5 } },
      { name: 'amount "abc"', body: { amount: 'abc' } },
      { name: 'empty amount string', body: { amount: '' } },
      { name: 'empty title', body: { title: '   ' } },
      { name: 'long title (>120)', body: { title: 'a'.repeat(121) } },
      { name: 'bad date string', body: { date: 'not-a-date' } },
      { name: 'boolean isRecurring not boolean', body: { isRecurring: 'yes' } },
    ];

    for (const testCase of invalidInputs) {
      const resVal: Response = await fetch(`${BASE_URL}/api/expenses/${ownerExpense.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': tempMemberUser.id,
        },
        body: JSON.stringify(testCase.body),
      });
      assert.equal(resVal.status, 400, `Expected 400 for ${testCase.name}, got ${resVal.status}`);
    }
    console.log('   ✓ All invalid inputs correctly rejected with 400');

    // 9. Category of another wallet -> 400
    console.log('9. Testing category of another wallet -> 400...');
    const resOtherCat = await fetch(`${BASE_URL}/api/expenses/${ownerExpense.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        categoryId: otherCategory.id,
      }),
    });
    assert.equal(resOtherCat.status, 400, `Expected 400 for category of another wallet, got ${resOtherCat.status}`);
    console.log('   ✓ Category of another wallet correctly rejected with 400');

    console.log('\n✅ All test-expense-patch assertions passed successfully!');
  } finally {
    console.log('\nCleaning up temporary test records...');

    // Clean up created expenses
    if (createdExpenseIds.length > 0) {
      await prisma.expense.deleteMany({
        where: { id: { in: createdExpenseIds } },
      }).catch((err) => console.error('Error deleting temp expenses:', err));
    }

    // Delete test activity logs first before users are deleted
    const tempUserIds = [tempMemberUser?.id, tempViewerUser?.id, tempNonMemberUser?.id].filter(
      (id): id is string => !!id
    );
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { userId: { in: tempUserIds } },
          { details: { contains: uniqueSuffix } },
        ],
      },
    }).catch(() => {});

    // Clean up memberships
    if (tempMemberMembership) {
      await prisma.walletMember.deleteMany({
        where: { id: tempMemberMembership.id },
      }).catch((err) => console.error('Error deleting temp member membership:', err));
    }
    if (tempViewerMembership) {
      await prisma.walletMember.deleteMany({
        where: { id: tempViewerMembership.id },
      }).catch((err) => console.error('Error deleting temp viewer membership:', err));
    }

    // Clean up users
    if (tempMemberUser) {
      await prisma.user.deleteMany({
        where: { id: tempMemberUser.id },
      }).catch((err) => console.error('Error deleting temp member user:', err));
    }
    if (tempViewerUser) {
      await prisma.user.deleteMany({
        where: { id: tempViewerUser.id },
      }).catch((err) => console.error('Error deleting temp viewer user:', err));
    }
    if (tempNonMemberUser) {
      await prisma.user.deleteMany({
        where: { id: tempNonMemberUser.id },
      }).catch((err) => console.error('Error deleting temp non-member user:', err));
    }

    const finalCounts = {
      user: await prisma.user.count(),
      walletMember: await prisma.walletMember.count(),
      expense: await prisma.expense.count(),
      plannedExpense: await prisma.plannedExpense.count(),
    };

    console.log('\nBEFORE counts:');
    console.table(initialCounts);
    console.log('AFTER counts:');
    console.table(finalCounts);

    assert.deepStrictEqual(finalCounts, initialCounts, 'BEFORE and AFTER counts must match exactly!');
    console.log('✓ All database counts match before and after.');

    await prisma.$disconnect();
    console.log('Cleanup completed.');
  }
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
