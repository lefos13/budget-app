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
  const createdPlannedExpenseIds: string[] = [];
  const createdExpenseIds: string[] = [];
  let tempWalletExport: { id: string; categories: Array<{ id: string; name: string }> } | null = null;
  let tempWalletImport: { id: string } | null = null;

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

    // 1. MEMBER creates planned expense (201)
    console.log('1. Testing MEMBER creates planned expense (201)...');
    const memberPlannedTitle = `Member Planned ${uniqueSuffix}`;
    const res1 = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: memberPlannedTitle,
        amount: 150.5,
        expectedDate: '2026-09-20',
        categoryId: wallet.categories[0].id,
        notes: 'Member test notes',
      }),
    });
    assert.equal(res1.status, 201, `Expected 201 on MEMBER create, got ${res1.status}`);
    const data1 = await res1.json();
    assert.ok(data1.plannedExpense?.id, 'Expected plannedExpense.id in response');
    assert.equal(data1.plannedExpense.title, memberPlannedTitle);
    assert.equal(data1.plannedExpense.amount, 150.5);
    assert.equal(data1.plannedExpense.status, 'PENDING');
    assert.equal(data1.plannedExpense.categoryId, wallet.categories[0].id);
    assert.ok(data1.plannedExpense.category, 'Expected category included');
    createdPlannedExpenseIds.push(data1.plannedExpense.id);
    console.log(`   ✓ Planned expense created with ID: ${data1.plannedExpense.id}`);

    // 2. VIEWER create -> 403
    console.log('2. Testing VIEWER create -> 403...');
    const res2 = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempViewerUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: `Viewer Planned ${uniqueSuffix}`,
        amount: 50.0,
        expectedDate: '2026-09-20',
      }),
    });
    assert.equal(res2.status, 403, `Expected 403 for VIEWER create, got ${res2.status}`);
    console.log('   ✓ VIEWER create rejected with 403');

    // 3. NON-MEMBER create 403 and GET 403
    console.log('3. Testing NON-MEMBER create 403 and GET 403...');
    const res3Post = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempNonMemberUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: `NonMember Planned ${uniqueSuffix}`,
        amount: 50.0,
        expectedDate: '2026-09-20',
      }),
    });
    assert.equal(res3Post.status, 403, `Expected 403 for NON-MEMBER create, got ${res3Post.status}`);

    const res3Get = await fetch(`${BASE_URL}/api/planned-expenses?walletId=${wallet.id}`, {
      headers: {
        'x-user-id': tempNonMemberUser.id,
      },
    });
    assert.equal(res3Get.status, 403, `Expected 403 for NON-MEMBER GET, got ${res3Get.status}`);
    console.log('   ✓ NON-MEMBER create and GET rejected with 403');

    // 4. Validation cases -> 400
    console.log('4. Testing validation cases -> 400...');
    const validationCases = [
      { name: 'amount 0', body: { walletId: wallet.id, title: 'Test', amount: 0, expectedDate: '2026-09-20' } },
      { name: 'negative amount', body: { walletId: wallet.id, title: 'Test', amount: -15, expectedDate: '2026-09-20' } },
      { name: 'amount "abc"', body: { walletId: wallet.id, title: 'Test', amount: 'abc', expectedDate: '2026-09-20' } },
      { name: 'empty title', body: { walletId: wallet.id, title: '   ', amount: 50, expectedDate: '2026-09-20' } },
      { name: 'bad date', body: { walletId: wallet.id, title: 'Test', amount: 50, expectedDate: 'not-a-date' } },
      { name: 'category of another wallet', body: { walletId: wallet.id, title: 'Test', amount: 50, expectedDate: '2026-09-20', categoryId: otherCategory.id } },
      { name: 'missing walletId', body: { title: 'Test', amount: 50, expectedDate: '2026-09-20' } },
    ];

    for (const testCase of validationCases) {
      const resVal = await fetch(`${BASE_URL}/api/planned-expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': ownerUser.id,
        },
        body: JSON.stringify(testCase.body),
      });
      assert.equal(resVal.status, 400, `Expected 400 for ${testCase.name}, got ${resVal.status}`);
    }

    // Invalid month in GET
    const resBadMonth = await fetch(`${BASE_URL}/api/planned-expenses?walletId=${wallet.id}&month=invalid-month`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resBadMonth.status, 400, `Expected 400 for bad month in GET, got ${resBadMonth.status}`);

    // Missing walletId in GET
    const resMissingWallet = await fetch(`${BASE_URL}/api/planned-expenses`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resMissingWallet.status, 400, `Expected 400 for missing walletId in GET, got ${resMissingWallet.status}`);
    console.log('   ✓ All validation cases rejected with 400');

    // 5. GET with month filter & wallet payload check
    console.log('5. Testing GET with month filter and wallet payload integration...');
    // Initial wallet check for totalSpentMonth
    const resWalletBefore = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resWalletBefore.status, 200);
    const walletBeforeData = await resWalletBefore.json();
    const initialTotalSpentMonth = walletBeforeData.metrics.totalSpentMonth;

    // Create item in Sept 2026
    const resSept = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: `Sept Planned ${uniqueSuffix}`,
        amount: 88.5,
        expectedDate: '2026-09-15',
        categoryId: wallet.categories[0].id,
      }),
    });
    assert.equal(resSept.status, 201);
    const dataSept = await resSept.json();
    const septPlannedId = dataSept.plannedExpense.id;
    createdPlannedExpenseIds.push(septPlannedId);

    // Create item in Oct 2026
    const resOct = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: `Oct Planned ${uniqueSuffix}`,
        amount: 120.0,
        expectedDate: '2026-10-15',
        categoryId: wallet.categories[0].id,
      }),
    });
    assert.equal(resOct.status, 201);
    const dataOct = await resOct.json();
    const octPlannedId = dataOct.plannedExpense.id;
    createdPlannedExpenseIds.push(octPlannedId);

    // Verify GET with month=2026-09
    const resGetSept = await fetch(`${BASE_URL}/api/planned-expenses?walletId=${wallet.id}&month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resGetSept.status, 200);
    const dataGetSept = await resGetSept.json();
    assert.ok(
      dataGetSept.plannedExpenses.some((p: { id: string }) => p.id === septPlannedId),
      'Sept planned expense must be returned for month=2026-09'
    );
    assert.ok(
      !dataGetSept.plannedExpenses.some((p: { id: string }) => p.id === octPlannedId),
      'Oct planned expense must NOT be returned for month=2026-09'
    );

    // Verify GET with month=2026-10
    const resGetOct = await fetch(`${BASE_URL}/api/planned-expenses?walletId=${wallet.id}&month=2026-10`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resGetOct.status, 200);
    const dataGetOct = await resGetOct.json();
    assert.ok(
      dataGetOct.plannedExpenses.some((p: { id: string }) => p.id === octPlannedId),
      'Oct planned expense must be returned for month=2026-10'
    );
    assert.ok(
      !dataGetOct.plannedExpenses.some((p: { id: string }) => p.id === septPlannedId),
      'Sept planned expense must NOT be returned for month=2026-10'
    );

    // Verify wallet payload GET /api/wallets/<id>?month=2026-09
    const resWalletAfter = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resWalletAfter.status, 200);
    const walletAfterData = await resWalletAfter.json();
    assert.ok(Array.isArray(walletAfterData.plannedExpenses), 'wallet payload must contain plannedExpenses array');
    assert.ok(
      walletAfterData.plannedExpenses.some((p: { id: string }) => p.id === septPlannedId),
      'wallet payload must contain Sept planned expense'
    );
    assert.ok(
      !walletAfterData.plannedExpenses.some((p: { id: string }) => p.id === octPlannedId),
      'wallet payload must NOT contain Oct planned expense'
    );
    assert.equal(
      walletAfterData.metrics.totalSpentMonth,
      initialTotalSpentMonth,
      'metrics.totalSpentMonth must be identical before and after creating planned expenses'
    );
    console.log('   ✓ Month filtering and wallet payload plannedExpenses verified without polluting totalSpentMonth');

    // 6. PATCH pending -> 200; PATCH after setting status REALIZED -> 409
    console.log('6. Testing PATCH pending -> 200 and PATCH realized -> 409...');
    const updatedTitle = `Updated Sept Planned ${uniqueSuffix}`;
    const patchRes = await fetch(`${BASE_URL}/api/planned-expenses/${septPlannedId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        title: updatedTitle,
        amount: 95.5,
      }),
    });
    assert.equal(patchRes.status, 200, `Expected 200 on PATCH pending, got ${patchRes.status}`);
    const patchData = await patchRes.json();
    assert.equal(patchData.plannedExpense.title, updatedTitle);
    assert.equal(patchData.plannedExpense.amount, 95.5);

    // Set status to REALIZED via prisma
    await prisma.plannedExpense.update({
      where: { id: septPlannedId },
      data: { status: 'REALIZED' },
    });

    // Attempt PATCH when REALIZED -> 409
    const patchRealizedRes = await fetch(`${BASE_URL}/api/planned-expenses/${septPlannedId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        amount: 110.0,
      }),
    });
    assert.equal(patchRealizedRes.status, 409, `Expected 409 on PATCH realized, got ${patchRealizedRes.status}`);
    const patchRealizedData = await patchRealizedRes.json();
    assert.equal(patchRealizedData.error, 'Realized planned expenses cannot be edited');
    console.log('   ✓ PATCH pending succeeded (200) and PATCH realized rejected (409)');

    // 7. DELETE -> 200 and gone; deleting REALIZED one leaves Expense intact
    console.log('7. Testing DELETE planned expenses and ensuring linked Expense stays intact...');
    // Create an Expense and link it as realizedExpense
    const tempExpense = await prisma.expense.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        title: `Realized Expense ${uniqueSuffix}`,
        amount: 95.5,
      },
    });
    createdExpenseIds.push(tempExpense.id);

    await prisma.plannedExpense.update({
      where: { id: septPlannedId },
      data: { realizedExpenseId: tempExpense.id },
    });

    // VIEWER cannot delete
    const resViewerDelete = await fetch(`${BASE_URL}/api/planned-expenses/${septPlannedId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': tempViewerUser.id,
      },
    });
    assert.equal(resViewerDelete.status, 403, `Expected 403 for VIEWER DELETE, got ${resViewerDelete.status}`);

    // OWNER deletes REALIZED planned expense
    const delSeptRes = await fetch(`${BASE_URL}/api/planned-expenses/${septPlannedId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': ownerUser.id,
      },
    });
    assert.equal(delSeptRes.status, 200, `Expected 200 on DELETE, got ${delSeptRes.status}`);
    const delSeptData = await delSeptRes.json();
    assert.equal(delSeptData.success, true);

    const septInDb = await prisma.plannedExpense.findUnique({ where: { id: septPlannedId } });
    assert.equal(septInDb, null, 'PlannedExpense must no longer exist in DB');
    const septIndex = createdPlannedExpenseIds.indexOf(septPlannedId);
    if (septIndex !== -1) createdPlannedExpenseIds.splice(septIndex, 1);

    // Linked Expense must still exist
    const expInDb = await prisma.expense.findUnique({ where: { id: tempExpense.id } });
    assert.ok(expInDb, 'Expense must still exist in DB after deleting PlannedExpense');

    // MEMBER deletes Oct planned expense
    const delOctRes = await fetch(`${BASE_URL}/api/planned-expenses/${octPlannedId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': tempMemberUser.id,
      },
    });
    assert.equal(delOctRes.status, 200, `Expected 200 on MEMBER DELETE, got ${delOctRes.status}`);
    const octInDb = await prisma.plannedExpense.findUnique({ where: { id: octPlannedId } });
    assert.equal(octInDb, null, 'Oct PlannedExpense must no longer exist in DB');
    const octIndex = createdPlannedExpenseIds.indexOf(octPlannedId);
    if (octIndex !== -1) createdPlannedExpenseIds.splice(octIndex, 1);

    // Delete initial item created in step 1
    const firstPlannedId = createdPlannedExpenseIds[0];
    if (firstPlannedId) {
      const delFirstRes = await fetch(`${BASE_URL}/api/planned-expenses/${firstPlannedId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': ownerUser.id,
        },
      });
      assert.equal(delFirstRes.status, 200);
      createdPlannedExpenseIds.shift();
    }
    console.log('   ✓ DELETE operations verified and linked Expense remained intact');

    // 8. Testing realize operations (POST /api/planned-expenses/[id]/realize)
    console.log('8. Testing realize operations (POST /api/planned-expenses/[id]/realize)...');

    // 8.1 MEMBER realizes a PENDING planned item -> 200, planned becomes REALIZED with realizedExpenseId,
    // Expense exists with the same title/amount/category and date = the sent date,
    // and wallet payload for that month shows totalSpentMonth increased by exactly that amount.
    console.log('   8.1 Testing MEMBER realizes PENDING planned item (200)...');
    const realizeTestTitle = `Realize Test ${uniqueSuffix}`;
    const resCreateRealize = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: realizeTestTitle,
        amount: 75.25,
        expectedDate: '2026-09-18',
        categoryId: wallet.categories[0].id,
        notes: 'Realize test note',
      }),
    });
    assert.equal(resCreateRealize.status, 201);
    const dataCreateRealize = await resCreateRealize.json();
    const realizePlannedId = dataCreateRealize.plannedExpense.id;
    createdPlannedExpenseIds.push(realizePlannedId);

    // Check wallet totalSpentMonth before realize
    const resWalletBeforeRealize = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resWalletBeforeRealize.status, 200);
    const walletBeforeRealize = await resWalletBeforeRealize.json();
    const spentBefore = walletBeforeRealize.metrics.totalSpentMonth;

    const sentDate = '2026-09-18';
    const resRealize = await fetch(`${BASE_URL}/api/planned-expenses/${realizePlannedId}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({
        date: sentDate,
      }),
    });
    assert.equal(resRealize.status, 200, `Expected 200 on MEMBER realize, got ${resRealize.status}`);
    const realizeData = await resRealize.json();
    assert.ok(realizeData.plannedExpense, 'Expected plannedExpense in realize response');
    assert.ok(realizeData.expense, 'Expected expense in realize response');
    createdExpenseIds.push(realizeData.expense.id);

    assert.equal(realizeData.plannedExpense.status, 'REALIZED');
    assert.equal(realizeData.plannedExpense.realizedExpenseId, realizeData.expense.id);
    assert.equal(realizeData.expense.title, realizeTestTitle);
    assert.equal(realizeData.expense.amount, 75.25);
    assert.equal(realizeData.expense.categoryId, wallet.categories[0].id);
    assert.equal(realizeData.expense.notes, 'Realize test note');
    assert.ok(realizeData.expense.date.startsWith(sentDate), `Expected expense date to start with ${sentDate}, got ${realizeData.expense.date}`);

    // Verify in DB directly
    const plannedInDb = await prisma.plannedExpense.findUnique({ where: { id: realizePlannedId } });
    assert.equal(plannedInDb?.status, 'REALIZED');
    assert.equal(plannedInDb?.realizedExpenseId, realizeData.expense.id);

    const expenseInDb = await prisma.expense.findUnique({ where: { id: realizeData.expense.id } });
    assert.ok(expenseInDb, 'Expense must exist in DB');
    assert.equal(expenseInDb.title, realizeTestTitle);
    assert.equal(expenseInDb.amount, 75.25);
    assert.equal(expenseInDb.categoryId, wallet.categories[0].id);

    // Verify wallet payload for that month shows totalSpentMonth increased by exactly that amount
    const resWalletAfterRealize = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resWalletAfterRealize.status, 200);
    const walletAfterRealize = await resWalletAfterRealize.json();
    const spentAfter = walletAfterRealize.metrics.totalSpentMonth;
    assert.equal(
      Math.round((spentAfter - spentBefore) * 100) / 100,
      75.25,
      `Expected totalSpentMonth to increase by exactly 75.25 (was ${spentBefore}, now ${spentAfter})`
    );
    console.log('   ✓ MEMBER realize succeeded, created linked Expense, and updated wallet totalSpentMonth');

    // 8.2 Realizing again -> 409 and Expense count unchanged
    console.log('   8.2 Testing realize again -> 409 and Expense count unchanged...');
    const expenseCountBeforeSecond = await prisma.expense.count({ where: { walletId: wallet.id } });
    const resRealizeAgain = await fetch(`${BASE_URL}/api/planned-expenses/${realizePlannedId}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({}),
    });
    assert.equal(resRealizeAgain.status, 409, `Expected 409 when realizing already realized expense, got ${resRealizeAgain.status}`);
    const expenseCountAfterSecond = await prisma.expense.count({ where: { walletId: wallet.id } });
    assert.equal(expenseCountAfterSecond, expenseCountBeforeSecond, 'Expense count must not change on 409 realize');
    console.log('   ✓ Realizing again rejected with 409 and Expense count unchanged');

    // 8.3 VIEWER -> 403, NON-MEMBER -> 403, unknown id -> 404
    console.log('   8.3 Testing VIEWER (403), NON-MEMBER (403), unknown id (404)...');
    const resCreatePending2 = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: `Pending For Auth Checks ${uniqueSuffix}`,
        amount: 40.0,
        expectedDate: '2026-09-22',
      }),
    });
    assert.equal(resCreatePending2.status, 201);
    const dataPending2 = await resCreatePending2.json();
    const pending2Id = dataPending2.plannedExpense.id;
    createdPlannedExpenseIds.push(pending2Id);

    const resViewerRealize = await fetch(`${BASE_URL}/api/planned-expenses/${pending2Id}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempViewerUser.id,
      },
    });
    assert.equal(resViewerRealize.status, 403, `Expected 403 for VIEWER realize, got ${resViewerRealize.status}`);

    const resNonMemberRealize = await fetch(`${BASE_URL}/api/planned-expenses/${pending2Id}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempNonMemberUser.id,
      },
    });
    assert.equal(resNonMemberRealize.status, 403, `Expected 403 for NON-MEMBER realize, got ${resNonMemberRealize.status}`);

    const resUnknownRealize = await fetch(`${BASE_URL}/api/planned-expenses/non-existent-id/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
    });
    assert.equal(resUnknownRealize.status, 404, `Expected 404 for unknown id realize, got ${resUnknownRealize.status}`);
    console.log('   ✓ VIEWER (403), NON-MEMBER (403), and unknown ID (404) verified');

    // 8.4 Validation: amount: 0 -> 400, invalid date -> 400
    console.log('   8.4 Testing amount: 0 -> 400 and invalid date -> 400...');
    const resAmountZero = await fetch(`${BASE_URL}/api/planned-expenses/${pending2Id}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({ amount: 0 }),
    });
    assert.equal(resAmountZero.status, 400, `Expected 400 for amount: 0, got ${resAmountZero.status}`);

    const resBadDate = await fetch(`${BASE_URL}/api/planned-expenses/${pending2Id}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({ date: 'not-a-valid-date' }),
    });
    assert.equal(resBadDate.status, 400, `Expected 400 for invalid date, got ${resBadDate.status}`);
    console.log('   ✓ Validation: amount: 0 and invalid date rejected with 400');

    // 8.5 Amount override respected
    console.log('   8.5 Testing amount override respected...');
    const resOverride = await fetch(`${BASE_URL}/api/planned-expenses/${pending2Id}/realize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': tempMemberUser.id,
      },
      body: JSON.stringify({ amount: 99.99, date: '2026-09-23' }),
    });
    assert.equal(resOverride.status, 200, `Expected 200 on realize with amount override, got ${resOverride.status}`);
    const dataOverride = await resOverride.json();
    assert.equal(dataOverride.expense.amount, 99.99, 'Expected expense amount to match overridden amount 99.99');
    createdExpenseIds.push(dataOverride.expense.id);
    console.log('   ✓ Amount override respected (99.99)');

    // 8.6 Two parallel realize requests (Promise.all) create exactly ONE Expense
    console.log('   8.6 Testing two parallel realize requests (Promise.all)...');
    const resCreateParallel = await fetch(`${BASE_URL}/api/planned-expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({
        walletId: wallet.id,
        title: `Parallel Realize ${uniqueSuffix}`,
        amount: 115.0,
        expectedDate: '2026-09-24',
      }),
    });
    assert.equal(resCreateParallel.status, 201);
    const dataParallel = await resCreateParallel.json();
    const parallelPlannedId = dataParallel.plannedExpense.id;
    createdPlannedExpenseIds.push(parallelPlannedId);

    const expCountBeforeParallel = await prisma.expense.count({ where: { walletId: wallet.id } });

    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/planned-expenses/${parallelPlannedId}/realize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': tempMemberUser.id,
        },
        body: JSON.stringify({}),
      }),
      fetch(`${BASE_URL}/api/planned-expenses/${parallelPlannedId}/realize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': tempMemberUser.id,
        },
        body: JSON.stringify({}),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [200, 409], `Expected one 200 and one 409 from parallel realizes, got ${statuses}`);

    const successfulRes = resA.status === 200 ? resA : resB;
    const succData = await successfulRes.json();
    createdExpenseIds.push(succData.expense.id);

    const expCountAfterParallel = await prisma.expense.count({ where: { walletId: wallet.id } });
    assert.equal(expCountAfterParallel, expCountBeforeParallel + 1, 'Parallel realize must create exactly ONE Expense');
    console.log('   ✓ Two parallel realize requests created exactly ONE Expense (one 200, one 409)');

    // 9. Testing export and import of planned expenses
    console.log('9. Testing export and import of planned expenses...');

    // Create temp wallet 1 (export wallet) with OWNER membership for ownerUser and category 'TmpCat'
    tempWalletExport = await prisma.wallet.create({
      data: {
        name: `Temp Export Wallet ${uniqueSuffix}`,
        currency: 'EUR',
        members: {
          create: {
            userId: ownerUser.id,
            role: 'OWNER',
          },
        },
        categories: {
          create: {
            name: 'TmpCat',
            icon: 'Tag',
            color: '#3b82f6',
          },
        },
      },
      include: {
        categories: true,
      },
    });
    const tmpCat = tempWalletExport.categories[0];

    // Add a PENDING planned expense in TmpCat
    const tempPlannedTitle = `Pending Planned In TmpCat ${uniqueSuffix}`;
    await prisma.plannedExpense.create({
      data: {
        walletId: tempWalletExport.id,
        userId: ownerUser.id,
        categoryId: tmpCat.id,
        title: tempPlannedTitle,
        amount: 60.0,
        expectedDate: new Date('2026-09-25'),
        notes: 'TmpCat planned notes',
        status: 'PENDING',
      },
    });

    // GET export as OWNER -> contains it with category: 'TmpCat'
    const exportRes = await fetch(`${BASE_URL}/api/wallets/${tempWalletExport.id}/export`, {
      headers: {
        'x-user-id': ownerUser.id,
      },
    });
    assert.equal(exportRes.status, 200, `Expected 200 on export, got ${exportRes.status}`);
    const exportedJson = await exportRes.json();
    assert.ok(Array.isArray(exportedJson.plannedExpenses), 'Exported JSON must contain plannedExpenses array');
    const exportedItem = exportedJson.plannedExpenses.find((p: { title: string }) => p.title === tempPlannedTitle);
    assert.ok(exportedItem, 'Exported JSON must contain the PENDING planned expense');
    assert.equal(exportedItem.category, 'TmpCat', 'Exported planned expense must have category: "TmpCat"');
    assert.equal(exportedItem.amount, 60.0);
    console.log('   ✓ GET export contains planned expense with category: "TmpCat"');

    // Create temp wallet 2 (import wallet) with OWNER membership for ownerUser
    tempWalletImport = await prisma.wallet.create({
      data: {
        name: `Temp Import Wallet ${uniqueSuffix}`,
        currency: 'EUR',
        members: {
          create: {
            userId: ownerUser.id,
            role: 'OWNER',
          },
        },
      },
    });

    // POST import of that JSON into SECOND temp wallet -> 200, imported.plannedExpenses === 1
    const importRes = await fetch(`${BASE_URL}/api/wallets/${tempWalletImport.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify(exportedJson),
    });
    assert.equal(importRes.status, 200, `Expected 200 on import, got ${importRes.status}`);
    const importData = await importRes.json();
    assert.equal(importData.success, true);
    assert.equal(importData.imported?.plannedExpenses, 1, `Expected imported.plannedExpenses === 1, got ${importData.imported?.plannedExpenses}`);

    // Verify row exists with mapped category
    const importedRow = await prisma.plannedExpense.findFirst({
      where: {
        walletId: tempWalletImport.id,
        title: tempPlannedTitle,
      },
      include: {
        category: true,
      },
    });
    assert.ok(importedRow, 'Imported planned expense must exist in DB in second wallet');
    assert.equal(importedRow.status, 'PENDING');
    assert.ok(importedRow.category, 'Imported planned expense must have mapped category');
    assert.equal(importedRow.category?.name, 'TmpCat');
    console.log('   ✓ POST import into second wallet imported planned expense with mapped category');

    // A JSON without plannedExpenses still imports (200)
    const jsonWithoutPlanned = {
      version: '1.0',
      categories: [{ name: `CatNoPlanned_${uniqueSuffix}` }],
      expenses: [],
      invoices: [],
    };
    const importResNoPlanned = await fetch(`${BASE_URL}/api/wallets/${tempWalletImport.id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify(jsonWithoutPlanned),
    });
    assert.equal(importResNoPlanned.status, 200, `Expected 200 on import without plannedExpenses, got ${importResNoPlanned.status}`);
    const importDataNoPlanned = await importResNoPlanned.json();
    assert.equal(importDataNoPlanned.success, true);
    assert.equal(importDataNoPlanned.imported?.plannedExpenses, 0);
    console.log('   ✓ JSON without plannedExpenses imports successfully (200)');

    console.log('\n✅ All test-planned-expenses assertions passed successfully!');
  } finally {
    console.log('\nCleaning up temporary test records...');

    // Clean up temp export and import wallets
    if (tempWalletImport) {
      await prisma.activityLog.deleteMany({ where: { walletId: tempWalletImport.id } }).catch(() => {});
      await prisma.plannedExpense.deleteMany({ where: { walletId: tempWalletImport.id } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { walletId: tempWalletImport.id } }).catch(() => {});
      await prisma.invoiceBill.deleteMany({ where: { walletId: tempWalletImport.id } }).catch(() => {});
      await prisma.category.deleteMany({ where: { walletId: tempWalletImport.id } }).catch(() => {});
      await prisma.walletMember.deleteMany({ where: { walletId: tempWalletImport.id } }).catch(() => {});
      await prisma.wallet.delete({ where: { id: tempWalletImport.id } }).catch(() => {});
    }
    if (tempWalletExport) {
      await prisma.activityLog.deleteMany({ where: { walletId: tempWalletExport.id } }).catch(() => {});
      await prisma.plannedExpense.deleteMany({ where: { walletId: tempWalletExport.id } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { walletId: tempWalletExport.id } }).catch(() => {});
      await prisma.invoiceBill.deleteMany({ where: { walletId: tempWalletExport.id } }).catch(() => {});
      await prisma.category.deleteMany({ where: { walletId: tempWalletExport.id } }).catch(() => {});
      await prisma.walletMember.deleteMany({ where: { walletId: tempWalletExport.id } }).catch(() => {});
      await prisma.wallet.delete({ where: { id: tempWalletExport.id } }).catch(() => {});
    }

    // Clean up created planned expenses
    if (createdPlannedExpenseIds.length > 0) {
      await prisma.plannedExpense.deleteMany({
        where: {
          OR: [
            { id: { in: createdPlannedExpenseIds } },
            { title: { contains: uniqueSuffix } },
          ],
        },
      }).catch((err) => console.error('Error deleting temp planned expenses:', err));
    }

    // Clean up created expenses
    if (createdExpenseIds.length > 0) {
      await prisma.expense.deleteMany({
        where: {
          OR: [
            { id: { in: createdExpenseIds } },
            { title: { contains: uniqueSuffix } },
          ],
        },
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
