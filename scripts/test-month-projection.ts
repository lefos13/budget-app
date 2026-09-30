import assert from 'node:assert/strict';
import { computeMonthProjection } from '../src/lib/month-projection';

function run() {
  console.log('🧪 Starting month projection unit test suite...\n');

  try {
    // 1. no data → projected = budget
    const res1 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1500,
      spent: 0,
      bills: [],
      planned: [],
    });
    assert.deepEqual(res1, {
      budget: 1500,
      spent: 0,
      savingsDeposited: 0,
      savingsDue: 0,
      boost: 0,
      plannedPending: 0,
      billsDue: 0,
      subscriptionsDue: 0,
      carryOver: 0,
      carryOverBills: 0,
      carryOverSubscriptions: 0,
      committedTotal: 0,
      projectedRemaining: 1500,
      isOverBudget: false,
      overBy: 0,
    });
    console.log('✓ Test 1: no data → projectedRemaining equals budget');

    // 2. spent + pending planned subtract, REALIZED planned does not
    const res2 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 2000,
      spent: 450,
      planned: [
        { amount: 150, expectedDate: '2026-09-10T00:00:00.000Z', status: 'PENDING' },
        { amount: 250, expectedDate: '2026-09-15T00:00:00.000Z', status: 'REALIZED' },
      ],
      bills: [],
    });
    assert.equal(res2.spent, 450);
    assert.equal(res2.plannedPending, 150);
    assert.equal(res2.committedTotal, 150);
    assert.equal(res2.projectedRemaining, 1400); // 2000 - 450 - 150
    assert.equal(res2.isOverBudget, false);
    assert.equal(res2.overBy, 0);
    console.log('✓ Test 2: spent and pending planned subtract; REALIZED planned excluded');

    // 3. unpaid bill due in month counted in billsDue; paid bill with linked expense in month NOT counted
    const res3 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 100, // includes the paid bill's expense
      bills: [
        {
          type: 'BILL',
          amount: 80,
          dueDate: '2026-09-15T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
        {
          type: 'BILL',
          amount: 100,
          dueDate: '2026-09-05T00:00:00.000Z',
          status: 'PAID',
          paidAt: '2026-09-06T12:00:00.000Z',
          linkedExpenseDate: '2026-09-06T12:00:00.000Z',
        },
      ],
      planned: [],
    });
    assert.equal(res3.billsDue, 80);
    assert.equal(res3.carryOverBills, 0);
    assert.equal(res3.committedTotal, 80);
    assert.equal(res3.projectedRemaining, 820); // 1000 - 100 - 80
    console.log('✓ Test 3: unpaid bill due in month counted in billsDue; paid bill with linked expense in month NOT counted');

    // 4. subscription due in month counted both PAID and unpaid
    const res4 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [
        {
          type: 'SUBSCRIPTION',
          amount: 20,
          dueDate: '2026-09-01T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
        {
          type: 'SUBSCRIPTION',
          amount: 30,
          dueDate: '2026-09-15T00:00:00.000Z',
          status: 'PAID',
          paidAt: '2026-09-15T08:00:00.000Z',
          linkedExpenseDate: null,
        },
      ],
      planned: [],
    });
    assert.equal(res4.subscriptionsDue, 50);
    assert.equal(res4.billsDue, 0);
    assert.equal(res4.committedTotal, 50);
    assert.equal(res4.projectedRemaining, 950);
    console.log('✓ Test 4: subscription due in month counted both PAID and unpaid in subscriptionsDue');

    // 5. carry-over: bill due Aug unpaid → shows as carryOverBills in Sep AND Oct;
    // after it is paid with linkedExpenseDate in Aug → carry-over 0 in Sep and Oct and not counted in Aug
    const unpaidAugBill = {
      type: 'BILL',
      amount: 120,
      dueDate: '2026-08-10T00:00:00.000Z',
      status: 'PENDING',
      paidAt: null,
      linkedExpenseDate: null,
    };

    // In Sep, unpaid bill from Aug is carry-over
    const res5SepUnpaid = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [unpaidAugBill],
      planned: [],
    });
    assert.equal(res5SepUnpaid.billsDue, 0);
    assert.equal(res5SepUnpaid.carryOverBills, 120);
    assert.equal(res5SepUnpaid.carryOver, 120);

    // In Oct, still unpaid bill from Aug is carry-over
    const res5OctUnpaid = computeMonthProjection({
      monthKey: '2026-10',
      monthlyBudget: 1000,
      spent: 0,
      bills: [unpaidAugBill],
      planned: [],
    });
    assert.equal(res5OctUnpaid.billsDue, 0);
    assert.equal(res5OctUnpaid.carryOverBills, 120);
    assert.equal(res5OctUnpaid.carryOver, 120);

    // After it is paid with linkedExpenseDate in Aug:
    const paidAugBill = {
      type: 'BILL',
      amount: 120,
      dueDate: '2026-08-10T00:00:00.000Z',
      status: 'PAID',
      paidAt: '2026-08-15T00:00:00.000Z',
      linkedExpenseDate: '2026-08-15T00:00:00.000Z',
    };

    // In Aug, paid bill with linkedExpenseDate in Aug is not in billsDue or carryOver (expense is in spent)
    const res5AugPaid = computeMonthProjection({
      monthKey: '2026-08',
      monthlyBudget: 1000,
      spent: 120,
      bills: [paidAugBill],
      planned: [],
    });
    assert.equal(res5AugPaid.billsDue, 0);
    assert.equal(res5AugPaid.carryOverBills, 0);
    assert.equal(res5AugPaid.carryOver, 0);
    assert.equal(res5AugPaid.projectedRemaining, 880);

    // In Sep, carry-over is 0
    const res5SepPaid = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [paidAugBill],
      planned: [],
    });
    assert.equal(res5SepPaid.carryOverBills, 0);
    assert.equal(res5SepPaid.carryOver, 0);

    // In Oct, carry-over is 0
    const res5OctPaid = computeMonthProjection({
      monthKey: '2026-10',
      monthlyBudget: 1000,
      spent: 0,
      bills: [paidAugBill],
      planned: [],
    });
    assert.equal(res5OctPaid.carryOverBills, 0);
    assert.equal(res5OctPaid.carryOver, 0);
    console.log('✓ Test 5: carry-over bill due Aug unpaid shows in Sep/Oct; when paid in Aug, carry-over is 0 in Sep/Oct and not counted in Aug');

    // 6. bill due Aug paid on Oct 5 (linked expense Oct 5):
    // Aug counts it as billsDue, Sep counts it as carry-over, Oct does not count it
    const billPaidInOct = {
      type: 'BILL',
      amount: 75,
      dueDate: '2026-08-20T00:00:00.000Z',
      status: 'PAID',
      paidAt: '2026-10-05T10:00:00.000Z',
      linkedExpenseDate: '2026-10-05T10:00:00.000Z',
    };

    // Aug: unpaid as of Aug 31 -> counts in billsDue
    const res6Aug = computeMonthProjection({
      monthKey: '2026-08',
      monthlyBudget: 1000,
      spent: 0,
      bills: [billPaidInOct],
      planned: [],
    });
    assert.equal(res6Aug.billsDue, 75);
    assert.equal(res6Aug.carryOverBills, 0);

    // Sep: unpaid as of Sep 30 -> counts in carryOverBills
    const res6Sep = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [billPaidInOct],
      planned: [],
    });
    assert.equal(res6Sep.billsDue, 0);
    assert.equal(res6Sep.carryOverBills, 75);
    assert.equal(res6Sep.carryOver, 75);

    // Oct: paid as of Oct 31 (linkedExpenseDate Oct 5 <= Oct 31) -> not counted in billsDue or carryOver
    const res6Oct = computeMonthProjection({
      monthKey: '2026-10',
      monthlyBudget: 1000,
      spent: 75, // in Oct's spent
      bills: [billPaidInOct],
      planned: [],
    });
    assert.equal(res6Oct.billsDue, 0);
    assert.equal(res6Oct.carryOverBills, 0);
    assert.equal(res6Oct.carryOver, 0);
    assert.equal(res6Oct.committedTotal, 0);
    assert.equal(res6Oct.projectedRemaining, 925);
    console.log('✓ Test 6: bill due Aug paid on Oct 5 counts in Aug billsDue, Sep carry-over, and not in Oct');

    // 7. legacy PAID bill with no linked expense and paidAt in the past → not counted; PAID with paidAt null → not counted
    const res7 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [
        {
          type: 'BILL',
          amount: 50,
          dueDate: '2026-08-10T00:00:00.000Z',
          status: 'PAID',
          paidAt: '2026-08-15T00:00:00.000Z',
          linkedExpenseDate: null,
        },
        {
          type: 'BILL',
          amount: 60,
          dueDate: '2026-09-10T00:00:00.000Z',
          status: 'PAID',
          paidAt: null,
          linkedExpenseDate: null,
        },
      ],
      planned: [],
    });
    assert.equal(res7.billsDue, 0);
    assert.equal(res7.carryOverBills, 0);
    assert.equal(res7.committedTotal, 0);
    assert.equal(res7.projectedRemaining, 1000);
    console.log('✓ Test 7: legacy PAID bill with no linked expense and paidAt in past or null is not counted');

    // 8. unpaid subscription due in Aug is carry-over in Sep; paid one (paidAt Aug 20) is not
    const res8 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [
        {
          type: 'SUBSCRIPTION',
          amount: 10,
          dueDate: '2026-08-01T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
        {
          type: 'SUBSCRIPTION',
          amount: 15,
          dueDate: '2026-08-15T00:00:00.000Z',
          status: 'PAID',
          paidAt: '2026-08-20T00:00:00.000Z',
          linkedExpenseDate: null,
        },
      ],
      planned: [],
    });
    assert.equal(res8.subscriptionsDue, 0);
    assert.equal(res8.carryOverSubscriptions, 10);
    assert.equal(res8.carryOver, 10);
    assert.equal(res8.committedTotal, 10);
    assert.equal(res8.projectedRemaining, 990);
    console.log('✓ Test 8: unpaid subscription due in Aug is carry-over in Sep; paid one (paidAt Aug 20) is not');

    // 9. negative result is NOT clamped and isOverBudget/overBy correct
    const res9 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 500,
      spent: 400,
      bills: [
        {
          type: 'BILL',
          amount: 250,
          dueDate: '2026-09-20T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
      ],
      planned: [],
    });
    assert.equal(res9.billsDue, 250);
    assert.equal(res9.committedTotal, 250);
    assert.equal(res9.projectedRemaining, -150);
    assert.equal(res9.isOverBudget, true);
    assert.equal(res9.overBy, 150);
    console.log('✓ Test 9: negative projectedRemaining is not clamped; isOverBudget and overBy are correct');

    // 10. bill due after E ignored
    const res10 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 1000,
      spent: 0,
      bills: [
        {
          type: 'BILL',
          amount: 100,
          dueDate: '2026-10-01T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
        {
          type: 'SUBSCRIPTION',
          amount: 50,
          dueDate: '2026-10-15T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
      ],
      planned: [],
    });
    assert.equal(res10.billsDue, 0);
    assert.equal(res10.subscriptionsDue, 0);
    assert.equal(res10.carryOver, 0);
    assert.equal(res10.committedTotal, 0);
    assert.equal(res10.projectedRemaining, 1000);
    assert.equal(res10.isOverBudget, false);
    assert.equal(res10.overBy, 0);
    console.log('✓ Test 10: bills and subscriptions due after E are ignored');

    // 11. a full hand-calculated example:
    // budget 2000, spent 300, planned pending 100, unpaid bill due in month 250,
    // subscription due in month 15 (paid), carry-over bill 80
    // → projectedRemaining = 2000 − 300 − 100 − 250 − 15 − 80 = 1255.
    const res11 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 2000,
      spent: 300,
      planned: [
        { amount: 100, expectedDate: '2026-09-10T00:00:00.000Z', status: 'PENDING' },
      ],
      bills: [
        {
          type: 'BILL',
          amount: 250,
          dueDate: '2026-09-18T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
        {
          type: 'SUBSCRIPTION',
          amount: 15,
          dueDate: '2026-09-05T00:00:00.000Z',
          status: 'PAID',
          paidAt: '2026-09-05T00:00:00.000Z',
          linkedExpenseDate: null,
        },
        {
          type: 'BILL',
          amount: 80,
          dueDate: '2026-08-25T00:00:00.000Z',
          status: 'PENDING',
          paidAt: null,
          linkedExpenseDate: null,
        },
      ],
    });
    assert.equal(res11.budget, 2000);
    assert.equal(res11.spent, 300);
    assert.equal(res11.plannedPending, 100);
    assert.equal(res11.billsDue, 250);
    assert.equal(res11.subscriptionsDue, 15);
    assert.equal(res11.carryOverBills, 80);
    assert.equal(res11.carryOverSubscriptions, 0);
    assert.equal(res11.carryOver, 80);
    assert.equal(res11.committedTotal, 445);
    assert.equal(res11.projectedRemaining, 1255);
    assert.equal(res11.isOverBudget, false);
    assert.equal(res11.overBy, 0);
    console.log('✓ Test 11: full hand-calculated example matches exactly (projectedRemaining = 1255)');

    // 12. savings: deposits count as used budget, the still-due contribution is committed,
    //     General boost raises the budget, and a linked expense due this month commits only its unfunded part
    const res12 = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 2000,
      spent: 300,
      planned: [
        { amount: 1000, expectedDate: '2026-09-20T00:00:00.000Z', status: 'PENDING', fundedAmount: 400 },
        { amount: 50, expectedDate: '2026-09-21T00:00:00.000Z', status: 'PENDING', fundedAmount: 80 },
      ],
      bills: [],
      savings: { deposited: 500, savingsDue: 375, boost: 100 },
    });
    assert.equal(res12.savingsDeposited, 500);
    assert.equal(res12.savingsDue, 375);
    assert.equal(res12.boost, 100);
    assert.equal(res12.plannedPending, 600); // 1000 − 400, over-funded item never negative
    assert.equal(res12.committedTotal, 975); // 600 + 375
    assert.equal(res12.projectedRemaining, 325); // 2000 + 100 − 300 − 500 − 975
    const res12b = computeMonthProjection({
      monthKey: '2026-09',
      monthlyBudget: 2000,
      spent: 300,
      planned: [],
      bills: [],
      savings: { deposited: 875, savingsDue: 0, boost: 0 },
    });
    assert.equal(res12b.projectedRemaining, 825, 'depositing the due amount moves it from committed to used');
    console.log('✓ Test 12: savings deposits, due contribution, boost and funded planned expenses');

    console.log('\n🎉 All month projection tests passed successfully!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

run();
