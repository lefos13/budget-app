import assert from 'node:assert/strict';
import {
  getDueDayDifference,
  isInvoiceOverdue,
  isInvoiceImminent,
  isInvoiceUrgent,
  isOverdueItem,
  getUrgentBills,
  getUnpaidForMonth,
  getAlertSummary,
  getAlertCount,
  hasOverdueAlerts,
  getAlertBadgeInfo,
  BaseAlertInvoice,
} from '../src/lib/bill-alerts';

function run() {
  const currentTz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'default';
  console.log(`🧪 Starting bill alerts unit test suite (TZ: ${currentTz})...\n`);

  try {
    // Fixed reference date: 2026-09-30 12:00:00 (midday prevents any midnight edge cases)
    const refDate = new Date(2026, 8, 30, 12, 0, 0); // Sep 30, 2026

    // --- 1. Today Boundaries ---
    // Past dates (-5 days, -1 day)
    assert.equal(getDueDayDifference(new Date(2026, 8, 25, 10, 0, 0), refDate), -5);
    assert.equal(isInvoiceOverdue(new Date(2026, 8, 25, 10, 0, 0), refDate), true);
    assert.equal(isInvoiceImminent(new Date(2026, 8, 25, 10, 0, 0), refDate), false);
    assert.equal(isInvoiceUrgent(new Date(2026, 8, 25, 10, 0, 0), refDate), true);

    assert.equal(getDueDayDifference(new Date(2026, 8, 29, 23, 59, 0), refDate), -1);
    assert.equal(isInvoiceOverdue(new Date(2026, 8, 29, 23, 59, 0), refDate), true);
    assert.equal(isInvoiceImminent(new Date(2026, 8, 29, 23, 59, 0), refDate), false);
    assert.equal(isInvoiceUrgent(new Date(2026, 8, 29, 23, 59, 0), refDate), true);

    // Today (0 days)
    assert.equal(getDueDayDifference(new Date(2026, 8, 30, 0, 0, 0), refDate), 0);
    assert.equal(isInvoiceOverdue(new Date(2026, 8, 30, 0, 0, 0), refDate), false);
    assert.equal(isInvoiceImminent(new Date(2026, 8, 30, 0, 0, 0), refDate), true);
    assert.equal(isInvoiceUrgent(new Date(2026, 8, 30, 0, 0, 0), refDate), true);

    // Tomorrow (+1 day)
    assert.equal(getDueDayDifference(new Date(2026, 9, 1, 0, 0, 0), refDate), 1);
    assert.equal(isInvoiceOverdue(new Date(2026, 9, 1, 0, 0, 0), refDate), false);
    assert.equal(isInvoiceImminent(new Date(2026, 9, 1, 0, 0, 0), refDate), true);
    assert.equal(isInvoiceUrgent(new Date(2026, 9, 1, 0, 0, 0), refDate), true);

    // In 3 days (+3 days) -> boundary of imminent
    assert.equal(getDueDayDifference(new Date(2026, 9, 3, 15, 0, 0), refDate), 3);
    assert.equal(isInvoiceOverdue(new Date(2026, 9, 3, 15, 0, 0), refDate), false);
    assert.equal(isInvoiceImminent(new Date(2026, 9, 3, 15, 0, 0), refDate), true);
    assert.equal(isInvoiceUrgent(new Date(2026, 9, 3, 15, 0, 0), refDate), true);

    // In 4 days (+4 days) -> NOT imminent, NOT urgent
    assert.equal(getDueDayDifference(new Date(2026, 9, 4, 10, 0, 0), refDate), 4);
    assert.equal(isInvoiceOverdue(new Date(2026, 9, 4, 10, 0, 0), refDate), false);
    assert.equal(isInvoiceImminent(new Date(2026, 9, 4, 10, 0, 0), refDate), false);
    assert.equal(isInvoiceUrgent(new Date(2026, 9, 4, 10, 0, 0), refDate), false);
    console.log('✓ Test 1: Today boundaries (overdue, today, +1, +3, +4 days) calculate correctly');

    // --- 2. Paid Excluded ---
    const sampleInvoices: BaseAlertInvoice[] = [
      { id: 'inv-1', title: 'Paid Bill', amount: 50, dueDate: '2026-09-30', status: 'PAID' },
      { id: 'inv-2', title: 'Paid Overdue Bill', amount: 120, dueDate: '2026-09-10', status: 'PAID' },
      { id: 'inv-3', title: 'Unpaid Today Bill', amount: 80, dueDate: '2026-09-30', status: 'PENDING' },
    ];
    const urgentPaidCheck = getUrgentBills(sampleInvoices, refDate);
    assert.equal(urgentPaidCheck.length, 1);
    assert.equal(urgentPaidCheck[0].id, 'inv-3');

    const monthPaidCheck = getUnpaidForMonth(sampleInvoices, '2026-09');
    assert.equal(monthPaidCheck.monthItems.length, 1);
    assert.equal(monthPaidCheck.monthItems[0].id, 'inv-3');
    assert.equal(monthPaidCheck.carryOverItems.length, 0);
    console.log('✓ Test 2: Invoices with status PAID are strictly excluded from urgent and unpaid sets');

    // --- 3. Carry-Over Logic ---
    const carryOverInvoices: BaseAlertInvoice[] = [
      { id: 'b-aug', title: 'August Electricity', amount: 150, dueDate: '2026-08-20', status: 'PENDING' },
      { id: 'b-sep', title: 'September Internet', amount: 40, dueDate: '2026-09-15', status: 'PENDING' },
      { id: 'b-oct', title: 'October Water', amount: 35, dueDate: '2026-10-05', status: 'PENDING' },
    ];
    // When viewing September:
    const sepResult = getUnpaidForMonth(carryOverInvoices, '2026-09');
    assert.equal(sepResult.monthItems.length, 1);
    assert.equal(sepResult.monthItems[0].id, 'b-sep');
    assert.equal(sepResult.monthTotal, 40);

    assert.equal(sepResult.carryOverItems.length, 1);
    assert.equal(sepResult.carryOverItems[0].id, 'b-aug');
    assert.equal(sepResult.carryOverTotal, 150);

    // October bill should not be in month or carry-over for Sep
    assert.equal(sepResult.monthItems.some((i) => i.id === 'b-oct'), false);
    assert.equal(sepResult.carryOverItems.some((i) => i.id === 'b-oct'), false);

    // When viewing October:
    const octResult = getUnpaidForMonth(carryOverInvoices, '2026-10');
    assert.equal(octResult.monthItems.length, 1);
    assert.equal(octResult.monthItems[0].id, 'b-oct');
    assert.equal(octResult.carryOverItems.length, 2); // August + September both carry over into October
    assert.equal(octResult.carryOverTotal, 190);
    console.log('✓ Test 3: Carry-over items accurately separate earlier unpaid bills from selected-month items');

    // --- 4. Subscriptions Included ---
    const mixedTypeInvoices: BaseAlertInvoice[] = [
      { id: 'sub-1', title: 'Netflix', amount: 15.99, dueDate: '2026-09-30', status: 'PENDING', type: 'SUBSCRIPTION' },
      { id: 'bill-1', title: 'Rent', amount: 800, dueDate: '2026-09-30', status: 'PENDING', type: 'BILL' },
      { id: 'sub-past', title: 'Spotify', amount: 9.99, dueDate: '2026-08-10', status: 'PENDING', type: 'SUBSCRIPTION' },
    ];
    const urgentSubs = getUrgentBills(mixedTypeInvoices, refDate);
    assert.equal(urgentSubs.length, 3); // All three are urgent (2 due today, 1 overdue)

    const monthSubs = getUnpaidForMonth(mixedTypeInvoices, '2026-09');
    assert.equal(monthSubs.monthItems.length, 2);
    assert.equal(monthSubs.monthTotal, 815.99);
    assert.equal(monthSubs.carryOverItems.length, 1);
    assert.equal(monthSubs.carryOverTotal, 9.99);
    console.log('✓ Test 4: Subscriptions are included in urgent, month items, and carry-over totals');

    // --- 5. Deduplication of Overlap & Distinct Badge Count ---
    // Case:
    // - bill A: due today (Sep 30) -> in urgentBills AND monthItems (Sep)
    // - bill B: due in August (Aug 15) -> in urgentBills (overdue) AND carryOverItems (Sep)
    // - bill C: due in Sep 10 (overdue) -> in urgentBills AND monthItems (Sep)
    // - bill D: due in Sep 25 (overdue) -> in urgentBills AND monthItems (Sep)
    // - bill E: due in Sep 28 (overdue) -> in urgentBills AND monthItems (Sep)
    // - bill F: due in Oct 2 (+2 days) -> in urgentBills (imminent) BUT NOT in Sep monthItems or carry-over!
    // - bill G: due in Sep 15 (paid) -> excluded everywhere
    const overlapInvoices: BaseAlertInvoice[] = [
      { id: 'A', title: 'Bill A', amount: 10, dueDate: '2026-09-30', status: 'PENDING' },
      { id: 'B', title: 'Bill B', amount: 20, dueDate: '2026-08-15', status: 'OVERDUE' },
      { id: 'C', title: 'Bill C', amount: 30, dueDate: '2026-09-10', status: 'PENDING' },
      { id: 'D', title: 'Bill D', amount: 40, dueDate: '2026-09-25', status: 'PENDING' },
      { id: 'E', title: 'Bill E', amount: 50, dueDate: '2026-09-28', status: 'PENDING' },
      { id: 'F', title: 'Bill F', amount: 60, dueDate: '2026-10-02', status: 'PENDING' },
      { id: 'G', title: 'Bill G', amount: 70, dueDate: '2026-09-15', status: 'PAID' },
    ];
    const summary = getAlertSummary(overlapInvoices, '2026-09', refDate);
    // Urgent: A (today), B (Aug overdue), C (Sep 10 overdue), D (Sep 25 overdue), E (Sep 28 overdue), F (Oct 2 imminent) = 6
    assert.equal(summary.urgentBills.length, 6);
    // MonthItems (Sep): A, C, D, E = 4
    assert.equal(summary.monthItems.length, 4);
    // CarryOver (Sep): B = 1
    assert.equal(summary.carryOverItems.length, 1);

    // Distinct count: union of {A, B, C, D, E, F} = 6 distinct IDs! (G is paid so excluded)
    assert.equal(summary.distinctCount, 6);
    assert.equal(getAlertCount(overlapInvoices, '2026-09', refDate), 6);
    assert.equal(summary.hasOverdue, true);
    assert.equal(hasOverdueAlerts(overlapInvoices, '2026-09', refDate), true);
    console.log('✓ Test 5: Distinct alert count deduplicates items present in multiple categories (urgent ∪ month ∪ carry-over)');

    // --- 6. Badge Colour, Overdue State & 99+ Cap ---
    // Only future imminent bill -> amber, count 1
    const futureOnly: BaseAlertInvoice[] = [
      { id: 'fut-1', title: 'Future Bill', amount: 25, dueDate: '2026-10-01', status: 'PENDING' },
    ];
    const badgeAmber = getAlertBadgeInfo(futureOnly, '2026-10', refDate);
    assert.equal(badgeAmber.count, 1);
    assert.equal(badgeAmber.countLabel, '1');
    assert.equal(badgeAmber.hasOverdue, false);
    assert.equal(badgeAmber.color, 'amber');
    assert.equal(badgeAmber.isVisible, true);

    // Overdue bill present -> rose
    const overduePresent: BaseAlertInvoice[] = [
      { id: 'fut-1', title: 'Future Bill', amount: 25, dueDate: '2026-10-01', status: 'PENDING' },
      { id: 'over-1', title: 'Late Bill', amount: 45, dueDate: '2026-09-28', status: 'OVERDUE' },
    ];
    const badgeRose = getAlertBadgeInfo(overduePresent, '2026-10', refDate);
    assert.equal(badgeRose.count, 2);
    assert.equal(badgeRose.hasOverdue, true);
    assert.equal(badgeRose.color, 'rose');

    // Zero items -> hidden
    const badgeEmpty = getAlertBadgeInfo([], '2026-09', refDate);
    assert.equal(badgeEmpty.count, 0);
    assert.equal(badgeEmpty.isVisible, false);

    // 120 items -> 99+ cap
    const manyInvoices: BaseAlertInvoice[] = Array.from({ length: 120 }, (_, i) => ({
      id: `inv-many-${i}`,
      title: `Bill ${i}`,
      amount: 10,
      dueDate: '2026-09-30',
      status: 'PENDING',
    }));
    const badgeCapped = getAlertBadgeInfo(manyInvoices, '2026-09', refDate);
    assert.equal(badgeCapped.count, 120);
    assert.equal(badgeCapped.countLabel, '99+');
    console.log('✓ Test 6: Badge info returns correct color (rose vs amber), visibility, and 99+ cap');

    // --- 7. Explicit Overdue Status overrides due date if needed ---
    const explicitOverdue: BaseAlertInvoice = {
      id: 'exp-1',
      title: 'Explicitly Overdue',
      amount: 50,
      dueDate: '2026-10-15', // Due in future
      status: 'OVERDUE',     // Marked OVERDUE
    };
    assert.equal(isOverdueItem(explicitOverdue, refDate), true);
    const summaryOverdue = getAlertSummary([explicitOverdue], '2026-10', refDate);
    assert.equal(summaryOverdue.hasOverdue, true);
    console.log('✓ Test 7: Explicit status OVERDUE is recognized correctly');

    console.log('\n🎉 ALL BILL ALERTS UNIT TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

run();
