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

  // Record initial counts
  const initialCounts = {
    user: await prisma.user.count(),
    walletMember: await prisma.walletMember.count(),
    invoiceBill: await prisma.invoiceBill.count(),
    expense: await prisma.expense.count(),
  };

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  let tempMemberUser: { id: string } | null = null;
  let tempViewerUser: { id: string } | null = null;
  let tempNonMemberUser: { id: string } | null = null;
  let tempMemberMembership: { id: string } | null = null;
  let tempViewerMembership: { id: string } | null = null;
  const createdInvoiceIds: string[] = [];
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

    // 1. VIEWER 403, NON-MEMBER 403, unknown id 404, invalid paidDate 400
    console.log('1. Testing auth and validation (VIEWER 403, NON-MEMBER 403, unknown id 404, invalid paidDate 400)...');
    const invAuth = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: `Invoice Auth Test ${uniqueSuffix}`,
        amount: 45.0,
        dueDate: new Date('2026-09-20'),
        status: 'PENDING',
        type: 'BILL',
      },
    });
    createdInvoiceIds.push(invAuth.id);

    // VIEWER -> 403
    const resViewer = await fetch(`${BASE_URL}/api/invoices/${invAuth.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': tempViewerUser.id },
    });
    assert.equal(resViewer.status, 403, `Expected 403 for VIEWER pay, got ${resViewer.status}`);

    // NON-MEMBER -> 403
    const resNonMember = await fetch(`${BASE_URL}/api/invoices/${invAuth.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': tempNonMemberUser.id },
    });
    assert.equal(resNonMember.status, 403, `Expected 403 for NON-MEMBER pay, got ${resNonMember.status}`);

    // Unknown id -> 404
    const resUnknown = await fetch(`${BASE_URL}/api/invoices/non-existent-invoice-id/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resUnknown.status, 404, `Expected 404 for unknown id pay, got ${resUnknown.status}`);

    // Invalid paidDate -> 400
    const invalidDates = ['invalid-date', '2026-02-31', '2026-13-01', '2026-08-32'];
    for (const badDate of invalidDates) {
      const resBadDate = await fetch(`${BASE_URL}/api/invoices/${invAuth.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': ownerUser.id,
        },
        body: JSON.stringify({ paidDate: badDate }),
      });
      assert.equal(resBadDate.status, 400, `Expected 400 for paidDate "${badDate}", got ${resBadDate.status}`);
    }
    console.log('   ✓ VIEWER (403), NON-MEMBER (403), unknown id (404), and invalid paidDate (400) verified');

    // 2. Pay twice -> one Expense with invoiceId set, second call 200 and expense count unchanged
    console.log('2. Testing pay twice (one Expense with invoiceId set, second call 200 and expense count unchanged)...');
    const invTwice = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: `Invoice Pay Twice ${uniqueSuffix}`,
        amount: 70.0,
        dueDate: new Date('2026-09-20'),
        status: 'PENDING',
        type: 'BILL',
      },
    });
    createdInvoiceIds.push(invTwice.id);

    const resPay1 = await fetch(`${BASE_URL}/api/invoices/${invTwice.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resPay1.status, 200, `Expected 200 on first pay call, got ${resPay1.status}`);
    const dataPay1 = await resPay1.json();
    assert.equal(dataPay1.invoice?.status, 'PAID');
    assert.equal(dataPay1.invoice?.paidByUserId, ownerUser.id);
    assert.ok(dataPay1.invoice?.paidAt);
    assert.ok(dataPay1.invoice?.category);
    assert.ok(dataPay1.invoice?.paidByUser);

    const exp1 = await prisma.expense.findFirst({
      where: { invoiceId: invTwice.id },
    });
    assert.ok(exp1, 'Expense must exist with invoiceId set');
    assert.equal(exp1.invoiceId, invTwice.id);
    assert.equal(exp1.amount, 70.0);
    assert.equal(exp1.title, invTwice.title);
    createdExpenseIds.push(exp1.id);

    const expCountBefore2 = await prisma.expense.count({ where: { walletId: wallet.id } });
    const resPay2 = await fetch(`${BASE_URL}/api/invoices/${invTwice.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resPay2.status, 200, `Expected 200 on second pay call, got ${resPay2.status}`);
    const dataPay2 = await resPay2.json();
    assert.equal(dataPay2.invoice?.status, 'PAID');
    assert.equal(dataPay2.invoice?.paidAt, dataPay1.invoice.paidAt);
    const expCountAfter2 = await prisma.expense.count({ where: { walletId: wallet.id } });
    assert.equal(expCountAfter2, expCountBefore2, 'Expense count must remain unchanged after second pay call');
    console.log('   ✓ Pay twice verified: single Expense with invoiceId, second call 200 and count unchanged');

    // 3. Two DIFFERENT invoices with the SAME title each get their own Expense (the old bug)
    console.log('3. Testing two DIFFERENT invoices with the SAME title each get their own Expense...');
    const sameTitle = `Duplicate Title Bill ${uniqueSuffix}`;
    const invA = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: sameTitle,
        amount: 35.0,
        dueDate: new Date('2026-09-10'),
        status: 'PENDING',
        type: 'BILL',
      },
    });
    createdInvoiceIds.push(invA.id);

    const invB = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: sameTitle,
        amount: 45.0,
        dueDate: new Date('2026-09-12'),
        status: 'PENDING',
        type: 'BILL',
      },
    });
    createdInvoiceIds.push(invB.id);

    const resA = await fetch(`${BASE_URL}/api/invoices/${invA.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resA.status, 200);

    const resB = await fetch(`${BASE_URL}/api/invoices/${invB.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resB.status, 200);

    const expA = await prisma.expense.findFirst({ where: { invoiceId: invA.id } });
    const expB = await prisma.expense.findFirst({ where: { invoiceId: invB.id } });
    assert.ok(expA, 'Expense A must be created for invoice A');
    assert.ok(expB, 'Expense B must be created for invoice B (old bug fixed)');
    assert.notEqual(expA.id, expB.id);
    assert.equal(expA.title, sameTitle);
    assert.equal(expB.title, sameTitle);
    assert.equal(expA.amount, 35.0);
    assert.equal(expB.amount, 45.0);
    createdExpenseIds.push(expA.id, expB.id);
    console.log('   ✓ Two different invoices with same title each created their own Expense');

    // 4. paidDate: '2026-08-10' -> Expense.date & invoice.paidAt fall on 2026-08-10, metrics check
    console.log('4. Testing paidDate: 2026-08-10, date matching and wallet metrics...');
    const resAugustBefore = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-08`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resAugustBefore.status, 200);
    const augustBeforeData = await resAugustBefore.json();
    const spentAugustBefore = augustBeforeData.metrics.totalSpentMonth;

    const resCurrentBefore = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resCurrentBefore.status, 200);
    const currentBeforeData = await resCurrentBefore.json();
    const spentCurrentBefore = currentBeforeData.metrics.totalSpentMonth;

    const invAug = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: `August Bill ${uniqueSuffix}`,
        amount: 110.0,
        dueDate: new Date('2026-08-05'),
        status: 'PENDING',
        type: 'BILL',
      },
    });
    createdInvoiceIds.push(invAug.id);

    const resAugPay = await fetch(`${BASE_URL}/api/invoices/${invAug.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ownerUser.id,
      },
      body: JSON.stringify({ paidDate: '2026-08-10' }),
    });
    assert.equal(resAugPay.status, 200);
    const augPayData = await resAugPay.json();
    assert.equal(augPayData.invoice?.status, 'PAID');
    assert.ok(
      new Date(augPayData.invoice.paidAt).toISOString().startsWith('2026-08-10'),
      `Expected invoice.paidAt to fall on 2026-08-10, got ${augPayData.invoice.paidAt}`
    );

    const expAug = await prisma.expense.findFirst({ where: { invoiceId: invAug.id } });
    assert.ok(expAug, 'Expense must exist for paid bill');
    assert.ok(
      new Date(expAug.date).toISOString().startsWith('2026-08-10'),
      `Expected Expense.date to fall on 2026-08-10, got ${expAug.date}`
    );
    createdExpenseIds.push(expAug.id);

    // Check wallet metrics
    const resAugustAfter = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-08`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resAugustAfter.status, 200);
    const augustAfterData = await resAugustAfter.json();
    const spentAugustAfter = augustAfterData.metrics.totalSpentMonth;
    assert.equal(
      Math.round((spentAugustAfter - spentAugustBefore) * 100) / 100,
      110.0,
      `Expected totalSpentMonth for 2026-08 to increase by 110.0 (was ${spentAugustBefore}, now ${spentAugustAfter})`
    );

    const resCurrentAfter = await fetch(`${BASE_URL}/api/wallets/${wallet.id}?month=2026-09`, {
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resCurrentAfter.status, 200);
    const currentAfterData = await resCurrentAfter.json();
    const spentCurrentAfter = currentAfterData.metrics.totalSpentMonth;
    assert.equal(
      spentCurrentAfter,
      spentCurrentBefore,
      'Expected totalSpentMonth for current month (2026-09) to remain unchanged'
    );
    console.log('   ✓ paidDate: 2026-08-10 sets date correctly and updates 2026-08 metrics without affecting current month');

    // 5. Subscription pay -> no Expense, invoice PAID
    console.log('5. Testing subscription pay (no Expense, invoice PAID)...');
    const expCountBeforeSub = await prisma.expense.count({ where: { walletId: wallet.id } });
    const invSub = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: `Netflix Sub ${uniqueSuffix}`,
        amount: 17.99,
        dueDate: new Date('2026-09-15'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    });
    createdInvoiceIds.push(invSub.id);

    const resSubPay = await fetch(`${BASE_URL}/api/invoices/${invSub.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resSubPay.status, 200);
    const subPayData = await resSubPay.json();
    assert.equal(subPayData.invoice?.status, 'PAID');

    const expCountAfterSub = await prisma.expense.count({ where: { walletId: wallet.id } });
    assert.equal(expCountAfterSub, expCountBeforeSub, 'Subscription pay must NEVER create an Expense');

    const subExpenseInDb = await prisma.expense.findFirst({ where: { invoiceId: invSub.id } });
    assert.equal(subExpenseInDb, null, 'No Expense row should exist for subscription');
    console.log('   ✓ Subscription marked PAID with 0 expenses created');

    // 6. Two parallel pay requests -> exactly ONE Expense
    console.log('6. Testing two parallel pay requests -> exactly ONE Expense...');
    const invParallel = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: `Parallel Invoice ${uniqueSuffix}`,
        amount: 85.0,
        dueDate: new Date('2026-09-22'),
        status: 'PENDING',
        type: 'BILL',
      },
    });
    createdInvoiceIds.push(invParallel.id);

    const expCountBeforeParallel = await prisma.expense.count({ where: { walletId: wallet.id } });

    const [parA, parB] = await Promise.all([
      fetch(`${BASE_URL}/api/invoices/${invParallel.id}/pay`, {
        method: 'POST',
        headers: { 'x-user-id': ownerUser.id },
      }),
      fetch(`${BASE_URL}/api/invoices/${invParallel.id}/pay`, {
        method: 'POST',
        headers: { 'x-user-id': ownerUser.id },
      }),
    ]);

    assert.equal(parA.status, 200, `Expected 200 on parA, got ${parA.status}`);
    assert.equal(parB.status, 200, `Expected 200 on parB, got ${parB.status}`);

    const expCountAfterParallel = await prisma.expense.count({ where: { walletId: wallet.id } });
    assert.equal(expCountAfterParallel, expCountBeforeParallel + 1, 'Two parallel pay requests must create exactly ONE Expense');

    const createdParExp = await prisma.expense.findFirst({ where: { invoiceId: invParallel.id } });
    assert.ok(createdParExp, 'Expense must exist for parallel invoice');
    createdExpenseIds.push(createdParExp.id);
    console.log('   ✓ Two parallel pay requests created exactly ONE Expense (both 200)');

    // 7. Pay a temp MONTHLY subscription due 2026-01-31 -> exactly one new PENDING/OVERDUE row with dueDate 2026-02-28, same title/amount/category, no Expense created
    console.log('7. Testing recurring subscription roll-forward (MONTHLY due 2026-01-31 -> next due 2026-02-28, no expense)...');
    const expCountBefore7 = await prisma.expense.count({ where: { walletId: wallet.id } });
    const invRollSub = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: `Spotify Sub ${uniqueSuffix}`,
        amount: 11.99,
        dueDate: new Date('2026-01-31'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
        reminderDaysBefore: 5,
        notes: 'Monthly music',
      },
    });
    createdInvoiceIds.push(invRollSub.id);

    const resRoll7 = await fetch(`${BASE_URL}/api/invoices/${invRollSub.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resRoll7.status, 200, `Expected 200 paying recurring subscription, got ${resRoll7.status}`);

    const subNextRows7 = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: invRollSub.title,
        type: 'SUBSCRIPTION',
      },
    });
    assert.equal(subNextRows7.length, 2, 'Expected 2 rows: original paid and newly rolled forward row');
    const rolledRow7 = subNextRows7.find((r) => r.id !== invRollSub.id);
    assert.ok(rolledRow7, 'Rolled forward row must exist');
    createdInvoiceIds.push(rolledRow7.id);

    assert.equal(rolledRow7.dueDate.toISOString().slice(0, 10), '2026-02-28');
    assert.ok(rolledRow7.status === 'PENDING' || rolledRow7.status === 'OVERDUE', 'Status must be PENDING or OVERDUE');
    assert.equal(rolledRow7.amount, 11.99);
    assert.equal(rolledRow7.categoryId, wallet.categories[0].id);
    assert.equal(rolledRow7.isRecurring, true);
    assert.equal(rolledRow7.recurrenceInterval, 'MONTHLY');
    assert.equal(rolledRow7.reminderDaysBefore, 5);
    assert.equal(rolledRow7.notes, 'Monthly music');
    assert.equal(rolledRow7.invoiceNumber, null);
    assert.equal(rolledRow7.paidAt, null);
    assert.equal(rolledRow7.paidByUserId, null);

    const expCountAfter7 = await prisma.expense.count({ where: { walletId: wallet.id } });
    assert.equal(expCountAfter7, expCountBefore7, 'Subscription roll-forward must NOT create any Expense records');
    console.log('   ✓ Recurring subscription rolled forward to 2026-02-28 with correct fields and 0 expenses');

    // 8. Pay the SAME invoice again -> still exactly one next row
    console.log('8. Testing pay the SAME subscription again -> still exactly one next row...');
    const resRoll8 = await fetch(`${BASE_URL}/api/invoices/${invRollSub.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resRoll8.status, 200);

    const subNextRows8 = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: invRollSub.title,
        type: 'SUBSCRIPTION',
      },
    });
    assert.equal(subNextRows8.length, 2, 'Paying the same invoice again must not create another next row');
    console.log('   ✓ Paying same subscription again preserves single next row');

    // 9. Create the Feb row first manually then pay Jan -> no duplicate
    console.log('9. Testing manual Feb row exists before paying Jan -> no duplicate next row...');
    const manualSubTitle = `Manual Feb First Sub ${uniqueSuffix}`;
    const invJanManual = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: manualSubTitle,
        amount: 14.99,
        dueDate: new Date('2026-01-31'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    });
    createdInvoiceIds.push(invJanManual.id);

    const invFebManual = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: manualSubTitle,
        amount: 14.99,
        dueDate: new Date('2026-02-28'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    });
    createdInvoiceIds.push(invFebManual.id);

    const resPayJan = await fetch(`${BASE_URL}/api/invoices/${invJanManual.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resPayJan.status, 200);

    const manualRows = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: manualSubTitle,
        type: 'SUBSCRIPTION',
      },
    });
    assert.equal(manualRows.length, 2, 'Must still be exactly 2 rows (Jan and Feb), no duplicate created');
    console.log('   ✓ Pre-existing Feb row prevented duplicate creation');

    // 10. Two parallel pays of a fresh subscription -> exactly ONE next row
    console.log('10. Testing two parallel pays of a fresh subscription -> exactly ONE next row...');
    const parallelSubTitle = `Parallel Fresh Sub ${uniqueSuffix}`;
    const invParSub = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: parallelSubTitle,
        amount: 22.0,
        dueDate: new Date('2026-01-31'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    });
    createdInvoiceIds.push(invParSub.id);

    const [pSub1, pSub2] = await Promise.all([
      fetch(`${BASE_URL}/api/invoices/${invParSub.id}/pay`, {
        method: 'POST',
        headers: { 'x-user-id': ownerUser.id },
      }),
      fetch(`${BASE_URL}/api/invoices/${invParSub.id}/pay`, {
        method: 'POST',
        headers: { 'x-user-id': ownerUser.id },
      }),
    ]);
    assert.equal(pSub1.status, 200);
    assert.equal(pSub2.status, 200);

    const parSubRows = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: parallelSubTitle,
        type: 'SUBSCRIPTION',
      },
    });
    assert.equal(parSubRows.length, 2, 'Two parallel pays of fresh subscription must produce exactly ONE next row');
    const rolledParSub = parSubRows.find((r) => r.id !== invParSub.id);
    assert.ok(rolledParSub);
    createdInvoiceIds.push(rolledParSub.id);
    console.log('   ✓ Parallel pays of subscription created exactly ONE next row');

    // 11. Non-recurring bill -> no next row
    console.log('11. Testing non-recurring bill -> no next row...');
    const nonRecTitle = `Non-recurring Bill ${uniqueSuffix}`;
    const invNonRec = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: nonRecTitle,
        amount: 55.0,
        dueDate: new Date('2026-01-31'),
        status: 'PENDING',
        type: 'BILL',
        isRecurring: false,
        recurrenceInterval: 'NONE',
      },
    });
    createdInvoiceIds.push(invNonRec.id);

    const resNonRec = await fetch(`${BASE_URL}/api/invoices/${invNonRec.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resNonRec.status, 200);

    const nonRecRows = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: nonRecTitle,
      },
    });
    assert.equal(nonRecRows.length, 1, 'Non-recurring bill must create NO next row');
    const nonRecExp = await prisma.expense.findFirst({ where: { invoiceId: invNonRec.id } });
    assert.ok(nonRecExp, 'Expense must be created for non-recurring bill');
    createdExpenseIds.push(nonRecExp.id);
    console.log('   ✓ Non-recurring bill created an Expense but no next row');

    // 12. Recurring BILL (type: 'BILL', isRecurring: true, recurrenceInterval: 'MONTHLY') -> next row created AND its Expense created
    console.log('12. Testing recurring BILL -> next row created AND its Expense created...');
    const recBillTitle = `Recurring Utility Bill ${uniqueSuffix}`;
    const invRecBill = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: recBillTitle,
        amount: 95.0,
        dueDate: new Date('2026-01-31'),
        status: 'PENDING',
        type: 'BILL',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    });
    createdInvoiceIds.push(invRecBill.id);

    const resRecBill = await fetch(`${BASE_URL}/api/invoices/${invRecBill.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resRecBill.status, 200);

    // Assert Expense created for paid bill
    const recBillExp = await prisma.expense.findFirst({ where: { invoiceId: invRecBill.id } });
    assert.ok(recBillExp, 'Recurring bill must create an Expense when paid');
    createdExpenseIds.push(recBillExp.id);

    // Assert next row created
    const recBillRows = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: recBillTitle,
      },
    });
    assert.equal(recBillRows.length, 2, 'Recurring bill must create exactly one next row');
    const rolledRecBill = recBillRows.find((r) => r.id !== invRecBill.id);
    assert.ok(rolledRecBill, 'Next row must exist for recurring bill');
    createdInvoiceIds.push(rolledRecBill.id);

    assert.equal(rolledRecBill.type, 'BILL');
    assert.equal(rolledRecBill.isRecurring, true);
    assert.equal(rolledRecBill.recurrenceInterval, 'MONTHLY');
    assert.equal(rolledRecBill.dueDate.toISOString().slice(0, 10), '2026-02-28');
    assert.ok(rolledRecBill.status === 'PENDING' || rolledRecBill.status === 'OVERDUE');

    // Assert NO expense created for the newly rolled-forward row
    const nextRowExp = await prisma.expense.findFirst({ where: { invoiceId: rolledRecBill.id } });
    assert.equal(nextRowExp, null, 'Newly rolled-forward row must NOT have an Expense');
    console.log('   ✓ Recurring BILL created its Expense and rolled forward to next month without extra expense');

    // 13. Interval 'NONE' subscription-typed edge: treat type === 'SUBSCRIPTION' with interval 'NONE' as MONTHLY
    console.log('13. Testing interval NONE subscription edge (treated as MONTHLY)...');
    const noneSubTitle = `None Interval Subscription ${uniqueSuffix}`;
    const invNoneSub = await prisma.invoiceBill.create({
      data: {
        walletId: wallet.id,
        userId: ownerUser.id,
        categoryId: wallet.categories[0].id,
        title: noneSubTitle,
        amount: 8.99,
        dueDate: new Date('2026-01-31'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'NONE',
      },
    });
    createdInvoiceIds.push(invNoneSub.id);

    const resNoneSub = await fetch(`${BASE_URL}/api/invoices/${invNoneSub.id}/pay`, {
      method: 'POST',
      headers: { 'x-user-id': ownerUser.id },
    });
    assert.equal(resNoneSub.status, 200);

    const noneSubRows = await prisma.invoiceBill.findMany({
      where: {
        walletId: wallet.id,
        title: noneSubTitle,
      },
    });
    assert.equal(noneSubRows.length, 2, 'Subscription with interval NONE must roll forward as MONTHLY');
    const rolledNoneSub = noneSubRows.find((r) => r.id !== invNoneSub.id);
    assert.ok(rolledNoneSub);
    createdInvoiceIds.push(rolledNoneSub.id);

    assert.equal(rolledNoneSub.dueDate.toISOString().slice(0, 10), '2026-02-28');
    assert.equal(rolledNoneSub.recurrenceInterval, 'MONTHLY');

    const noneSubExp = await prisma.expense.findFirst({ where: { invoiceId: invNoneSub.id } });
    assert.equal(noneSubExp, null, 'Subscription must create 0 expenses');
    console.log('   ✓ Subscription with interval NONE successfully rolled forward as MONTHLY with 0 expenses');

    console.log('\n✅ All test-pay-invoice assertions passed successfully!');
  } finally {
    console.log('\nCleaning up temporary test records...');

    // Clean up created expenses
    if (createdExpenseIds.length > 0) {
      await prisma.expense.deleteMany({
        where: {
          OR: [
            { id: { in: createdExpenseIds } },
            { title: { contains: uniqueSuffix } },
            { invoiceId: { in: createdInvoiceIds } },
          ],
        },
      }).catch((err) => console.error('Error deleting temp expenses:', err));
    }

    // Clean up created invoice bills
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceBill.deleteMany({
        where: {
          OR: [
            { id: { in: createdInvoiceIds } },
            { title: { contains: uniqueSuffix } },
          ],
        },
      }).catch((err) => console.error('Error deleting temp invoice bills:', err));
    }

    // Delete test activity logs before users are deleted
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
      invoiceBill: await prisma.invoiceBill.count(),
      expense: await prisma.expense.count(),
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
