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
    category: await prisma.category.count(),
    expense: await prisma.expense.count(),
    invoiceBill: await prisma.invoiceBill.count(),
    plannedExpense: await prisma.plannedExpense.count(),
  };

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let tempMemberUser: { id: string } | null = null;
  let tempViewerUser: { id: string } | null = null;
  let tempNonMemberUser: { id: string } | null = null;
  let tempMemberMembership: { id: string } | null = null;
  let tempViewerMembership: { id: string } | null = null;
  let createdCategoryId: string | null = null;
  let tempExpense: { id: string } | null = null;
  let tempInvoice: { id: string } | null = null;
  let tempPlanned: { id: string } | null = null;
  const originalBudget = wallet.monthlyBudget;

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

    // 1. OWNER creates category (201) with limit 123.45
    console.log('1. Testing OWNER creates category (201) with limit 123.45...');
    const testCatName = `Test Cat ${uniqueSuffix}`;
    const res1 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: testCatName,
        color: '#10b981',
        icon: 'Tag',
        monthlyLimit: 123.45,
      }),
    });
    assert.equal(res1.status, 201, `Expected 201 on create category, got ${res1.status}`);
    const data1 = await res1.json();
    assert.ok(data1.category?.id, 'Expected category.id in response');
    assert.equal(data1.category.name, testCatName);
    assert.equal(data1.category.monthlyLimit, 123.45);
    assert.equal(data1.category.color, '#10b981');
    assert.equal(data1.category.icon, 'Tag');
    createdCategoryId = data1.category.id;
    console.log(`   ✓ Category created with ID: ${createdCategoryId}`);

    // 2. duplicate name in different case -> 409
    console.log('2. Testing duplicate name in different case -> 409...');
    const res2 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: `  ${testCatName.toUpperCase()}  `,
      }),
    });
    assert.equal(res2.status, 409, `Expected 409 for duplicate name, got ${res2.status}`);
    console.log('   ✓ Duplicate name rejected with 409');

    // 3. invalid color -> 400
    console.log('3. Testing invalid color -> 400...');
    const res3 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: `Invalid Color Cat ${uniqueSuffix}`,
        color: 'invalid-hex',
      }),
    });
    assert.equal(res3.status, 400, `Expected 400 for invalid color, got ${res3.status}`);
    console.log('   ✓ Invalid color rejected with 400');

    // 4. negative limit -> 400
    console.log('4. Testing negative limit -> 400...');
    const res4 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: `Negative Limit Cat ${uniqueSuffix}`,
        monthlyLimit: -50,
      }),
    });
    assert.equal(res4.status, 400, `Expected 400 for negative monthlyLimit, got ${res4.status}`);
    console.log('   ✓ Negative limit rejected with 400');

    // 5. empty name -> 400
    console.log('5. Testing empty name -> 400...');
    const res5 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: '   ',
      }),
    });
    assert.equal(res5.status, 400, `Expected 400 for empty name, got ${res5.status}`);
    console.log('   ✓ Empty name rejected with 400');

    // 6. MEMBER/VIEWER/NON-MEMBER create -> 403
    console.log('6. Testing MEMBER/VIEWER/NON-MEMBER create -> 403...');
    const nonOwnerUsers = [
      { role: 'MEMBER', user: tempMemberUser! },
      { role: 'VIEWER', user: tempViewerUser! },
      { role: 'NON-MEMBER', user: tempNonMemberUser! },
    ];
    for (const item of nonOwnerUsers) {
      const resRole: Response = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': item.user.id,
        },
        body: JSON.stringify({
          name: `Forbidden ${item.role} ${uniqueSuffix}`,
        }),
      });
      assert.equal(resRole.status, 403, `Expected 403 for ${item.role} create, got ${resRole.status}`);
      const dataRole = await resRole.json();
      assert.equal(dataRole.error, 'Only the wallet owner can manage categories');
    }
    console.log('   ✓ Non-owner category creations rejected with 403');

    // 7. OWNER PATCH name + limit null -> 200 and DB shows null limit
    console.log('7. Testing OWNER PATCH name + limit null -> 200 and DB shows null limit...');
    const updatedCatName = `Updated Cat ${uniqueSuffix}`;
    const res7 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories/${createdCategoryId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: updatedCatName,
        monthlyLimit: null,
      }),
    });
    assert.equal(res7.status, 200, `Expected 200 on PATCH category, got ${res7.status}`);
    const data7 = await res7.json();
    assert.equal(data7.category.name, updatedCatName);
    assert.equal(data7.category.monthlyLimit, null);

    const inDb = await prisma.category.findUnique({
      where: { id: createdCategoryId! },
    });
    assert.ok(inDb, 'Category must exist in DB');
    assert.equal(inDb.name, updatedCatName);
    assert.equal(inDb.monthlyLimit, null);
    console.log('   ✓ Category name and limit null successfully updated in API and DB');

    // 8. PATCH of a category from another wallet via this wallet id -> 404
    console.log('8. Testing PATCH of a category from another wallet via this wallet id -> 404...');
    const res8 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories/${otherCategory.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        name: `Cross Wallet Name ${uniqueSuffix}`,
      }),
    });
    assert.equal(res8.status, 404, `Expected 404 for cross-wallet category PATCH, got ${res8.status}`);
    console.log('   ✓ Cross-wallet category PATCH rejected with 404');

    // 9. PATCH wallet budget via PATCH /api/wallets/<id> as MEMBER -> 403, as OWNER -> 200
    console.log('9. Testing PATCH wallet budget as MEMBER -> 403, as OWNER -> 200...');
    const res9Member = await fetch(`${BASE_URL}/api/wallets/${wallet.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        monthlyBudget: originalBudget + 100,
      }),
    });
    assert.equal(res9Member.status, 403, `Expected 403 when MEMBER patches wallet settings, got ${res9Member.status}`);
    const data9Member = await res9Member.json();
    assert.equal(data9Member.error, 'Only the wallet owner can edit wallet settings');

    const res9Owner = await fetch(`${BASE_URL}/api/wallets/${wallet.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        monthlyBudget: originalBudget + 100,
      }),
    });
    assert.equal(res9Owner.status, 200, `Expected 200 when OWNER patches wallet settings, got ${res9Owner.status}`);
    const data9Owner = await res9Owner.json();
    assert.equal(data9Owner.wallet.monthlyBudget, originalBudget + 100);

    // Restore budget back
    const res9Restore = await fetch(`${BASE_URL}/api/wallets/${wallet.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        monthlyBudget: originalBudget,
      }),
    });
    assert.equal(res9Restore.status, 200, `Expected 200 when restoring wallet budget, got ${res9Restore.status}`);
    const restoredWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
    assert.equal(restoredWallet?.monthlyBudget, originalBudget);
    console.log('   ✓ Wallet budget patch permissions verified and budget restored');

    // 10. DELETE with temp Expense + temp InvoiceBill + temp PlannedExpense attached -> 200
    console.log('10. Testing DELETE category with Expense, InvoiceBill, and PlannedExpense attached...');
    tempExpense = await prisma.expense.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: createdCategoryId!,
        title: `Temp Expense ${uniqueSuffix}`,
        amount: 42.5,
      },
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    tempInvoice = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: createdCategoryId!,
        title: `Temp Bill ${uniqueSuffix}`,
        amount: 55.0,
        dueDate,
      },
    });

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 14);
    tempPlanned = await prisma.plannedExpense.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: createdCategoryId!,
        title: `Temp Planned ${uniqueSuffix}`,
        amount: 65.0,
        expectedDate,
      },
    });

    const expCountBeforeDelete = await prisma.expense.count();
    const invCountBeforeDelete = await prisma.invoiceBill.count();
    const planCountBeforeDelete = await prisma.plannedExpense.count();

    const res10 = await fetch(`${BASE_URL}/api/wallets/${wallet.id}/categories/${createdCategoryId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': ownerUser.id,
      },
    });
    assert.equal(res10.status, 200, `Expected 200 on DELETE category, got ${res10.status}`);
    const data10 = await res10.json();
    assert.equal(data10.success, true);
    assert.ok(data10.detached);
    assert.equal(data10.detached.expenses, 1);
    assert.equal(data10.detached.invoices, 1);
    assert.equal(data10.detached.plannedExpenses, 1);

    // Assert category is gone
    const catInDb = await prisma.category.findUnique({ where: { id: createdCategoryId! } });
    assert.equal(catInDb, null, 'Deleted category must no longer exist in DB');
    createdCategoryId = null; // Successfully deleted by API

    // Assert the three rows still exist with categoryId null
    const expInDb = await prisma.expense.findUnique({ where: { id: tempExpense.id } });
    assert.ok(expInDb, 'Expense row must still exist');
    assert.equal(expInDb.categoryId, null, 'Expense categoryId must be null');

    const invInDb = await prisma.invoiceBill.findUnique({ where: { id: tempInvoice.id } });
    assert.ok(invInDb, 'InvoiceBill row must still exist');
    assert.equal(invInDb.categoryId, null, 'InvoiceBill categoryId must be null');

    const planInDb = await prisma.plannedExpense.findUnique({ where: { id: tempPlanned.id } });
    assert.ok(planInDb, 'PlannedExpense row must still exist');
    assert.equal(planInDb.categoryId, null, 'PlannedExpense categoryId must be null');

    // Assert counts unchanged
    const expCountAfterDelete = await prisma.expense.count();
    const invCountAfterDelete = await prisma.invoiceBill.count();
    const planCountAfterDelete = await prisma.plannedExpense.count();
    assert.equal(expCountAfterDelete, expCountBeforeDelete, 'Expense count must be unchanged');
    assert.equal(invCountAfterDelete, invCountBeforeDelete, 'InvoiceBill count must be unchanged');
    assert.equal(planCountAfterDelete, planCountBeforeDelete, 'PlannedExpense count must be unchanged');
    console.log('   ✓ Category deleted, rows detached with categoryId null, row counts unchanged');

    console.log('\n✅ All test-categories assertions passed successfully!');
  } finally {
    console.log('\nCleaning up temporary test records...');

    // Restore wallet budget if needed
    if (originalBudget !== undefined) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { monthlyBudget: originalBudget },
      }).catch(() => {});
    }

    // Delete temp rows created directly
    if (tempExpense) {
      await prisma.expense.deleteMany({ where: { id: tempExpense.id } }).catch((err) =>
        console.error('Error deleting temp expense:', err)
      );
    }
    if (tempInvoice) {
      await prisma.invoiceBill.deleteMany({ where: { id: tempInvoice.id } }).catch((err) =>
        console.error('Error deleting temp invoice:', err)
      );
    }
    if (tempPlanned) {
      await prisma.plannedExpense.deleteMany({ where: { id: tempPlanned.id } }).catch((err) =>
        console.error('Error deleting temp planned expense:', err)
      );
    }
    if (createdCategoryId) {
      await prisma.category.deleteMany({ where: { id: createdCategoryId } }).catch((err) =>
        console.error('Error deleting temp category:', err)
      );
    }
    if (tempMemberMembership) {
      await prisma.walletMember.deleteMany({ where: { id: tempMemberMembership.id } }).catch((err) =>
        console.error('Error deleting temp member membership:', err)
      );
    }
    if (tempViewerMembership) {
      await prisma.walletMember.deleteMany({ where: { id: tempViewerMembership.id } }).catch((err) =>
        console.error('Error deleting temp viewer membership:', err)
      );
    }
    if (tempMemberUser) {
      await prisma.user.deleteMany({ where: { id: tempMemberUser.id } }).catch((err) =>
        console.error('Error deleting temp member user:', err)
      );
    }
    if (tempViewerUser) {
      await prisma.user.deleteMany({ where: { id: tempViewerUser.id } }).catch((err) =>
        console.error('Error deleting temp viewer user:', err)
      );
    }
    if (tempNonMemberUser) {
      await prisma.user.deleteMany({ where: { id: tempNonMemberUser.id } }).catch((err) =>
        console.error('Error deleting temp non-member user:', err)
      );
    }

    // Delete test activity logs
    await prisma.activityLog.deleteMany({
      where: {
        walletId: wallet.id,
        details: { contains: uniqueSuffix },
      },
    }).catch(() => {});

    const finalCounts = {
      user: await prisma.user.count(),
      walletMember: await prisma.walletMember.count(),
      category: await prisma.category.count(),
      expense: await prisma.expense.count(),
      invoiceBill: await prisma.invoiceBill.count(),
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
