import assert from 'node:assert/strict';
import {
  allocate,
  canLinkToSavings,
  computeBucketMonth,
  computeSavingsMonth,
  monthsLeft,
  SavingsBucketInput,
  SavingsLedgerEntry,
} from '../src/lib/savings';
import { addMonthsToKey, getMonthKey } from '../src/lib/month';

// Local-time dates so month attribution is TZ-independent in intent.
const d = (y: number, m: number, day = 15) => new Date(y, m - 1, day, 12, 0, 0);

function run() {
  console.log(`🧪 Starting savings math unit test suite (TZ=${process.env.TZ ?? 'system'})...\n`);

  // 1. monthsLeft counts contributions in months M … E−1
  assert.equal(monthsLeft('2026-09', d(2027, 3, 1)), 6);
  assert.equal(monthsLeft('2026-12', d(2027, 1, 1)), 1); // Dec → Jan
  assert.equal(monthsLeft('2026-09', d(2026, 9, 30)), 0); // due month
  assert.equal(monthsLeft('2026-09', d(2026, 7, 1)), -2); // overdue
  assert.equal(monthsLeft('2028-02', new Date(2028, 1, 29, 23, 59, 59)), 0); // leap Feb, last second
  assert.equal(monthsLeft('2028-02', new Date(2028, 2, 1, 0, 0, 0)), 1); // first second of March
  console.log('✓ Test 1: monthsLeft month arithmetic incl. year rollover and month boundaries');

  // 2. linking only for future months
  const now = new Date(2026, 8, 30, 10, 0, 0); // 2026-09-30 local
  assert.equal(canLinkToSavings(d(2026, 10, 1), now), true);
  assert.equal(canLinkToSavings(new Date(2026, 8, 30, 23, 59, 59), now), false);
  assert.equal(canLinkToSavings(d(2026, 1, 1), now), false);
  assert.equal(canLinkToSavings('not-a-date', now), false);
  console.log('✓ Test 2: only future-month expenses are linkable');

  // 3. example from the plan: €3,000 in 6 months + €9,000 in 24 months, balance 0 → €500 + €375
  const pending = [
    { id: 'down', amount: 3000, expectedDate: d(2027, 3) },
    { id: 'rest', amount: 9000, expectedDate: d(2028, 9) },
  ];
  const car: SavingsBucketInput = { id: 'car', kind: 'GOAL', ledger: [], pending };
  const m0 = computeBucketMonth(car, '2026-09', now);
  assert.equal(m0.contributionDue, 875);
  assert.equal(m0.savingsDue, 875);
  assert.equal(m0.target, 12000);
  console.log('✓ Test 3: per-expense contributions sum (500 + 375 = 875)');

  // 4. depositing the due amount satisfies the month; an extra top-up lowers next month
  const paidDue: SavingsLedgerEntry[] = [{ type: 'DEPOSIT', amount: 875, date: d(2026, 9, 20) }];
  const withDue = computeBucketMonth({ ...car, ledger: paidDue }, '2026-09', now);
  assert.equal(withDue.savingsDue, 0);
  assert.equal(withDue.contributionDue, 875); // stable within the month (start-of-month balance)
  assert.equal(withDue.deposited, 875);

  const nowOct = new Date(2026, 9, 5);
  const nextNoExtra = computeBucketMonth({ ...car, ledger: paidDue }, '2026-10', nowOct).contributionDue;
  const withExtra: SavingsLedgerEntry[] = [...paidDue, { type: 'DEPOSIT', amount: 1000, date: d(2026, 9, 25) }];
  const nextWithExtra = computeBucketMonth({ ...car, ledger: withExtra }, '2026-10', nowOct).contributionDue;
  assert.ok(nextWithExtra < nextNoExtra, `extra top-up should lower next month (${nextWithExtra} < ${nextNoExtra})`);
  // Down payment gets allocated first: 1875 of 3000 → 1125 / 5 = 225; rest 9000 / 23 = 391.31
  assert.equal(nextWithExtra, 225 + 391.31);
  console.log('✓ Test 4: due satisfied by deposit; extra top-up lowers next month, earliest first');

  // 5. a skipped month is caught up by the next month
  const skipped = computeBucketMonth(car, '2026-10', nowOct).contributionDue;
  // 3000 / 5 = 600 ; 9000 / 23 = 391.31
  assert.equal(skipped, 600 + 391.31);
  assert.ok(skipped > nextNoExtra);
  console.log('✓ Test 5: skipped month → next month catches up');

  // 6. following the schedule funds every expense by its own due month, never short by rounding
  const odd: SavingsBucketInput = {
    id: 'odd',
    kind: 'GOAL',
    ledger: [],
    pending: [
      { id: 'a', amount: 1000, expectedDate: d(2027, 1) },
      { id: 'b', amount: 777.77, expectedDate: d(2027, 4) },
      { id: 'c', amount: 10000, expectedDate: d(2029, 11) },
    ],
  };
  const ledger: SavingsLedgerEntry[] = [];
  let open = [...odd.pending];
  let key = '2026-09';
  let totalDeposited = 0;
  for (let i = 0; i < 48 && open.length > 0; i++) {
    const monthNow = new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 2);
    // pay expenses due this month from the bucket
    const bal = ledger.reduce((s, e) => s + e.amount, 0);
    const alloc = allocate(bal, open, key);
    for (const a of alloc) {
      if (getMonthKey(a.expectedDate) === key) {
        assert.ok(a.remaining <= 0.0001, `expense ${a.id} short by ${a.remaining} in ${key}`);
        ledger.push({ type: 'EXPENSE_DRAW', amount: -a.amount, date: monthNow });
        open = open.filter((p) => p.id !== a.id);
      }
    }
    const due = computeBucketMonth({ ...odd, ledger, pending: open }, key, monthNow).savingsDue;
    if (due > 0) {
      ledger.push({ type: 'DEPOSIT', amount: due, date: new Date(monthNow.getTime() + 86400000) });
      totalDeposited += due;
    }
    key = addMonthsToKey(key, 1);
  }
  assert.equal(open.length, 0, 'all expenses paid');
  assert.ok(totalDeposited >= 11777.77 - 0.0001, `deposited ${totalDeposited}`);
  assert.ok(totalDeposited - 11777.77 < 1, `over-saving from rounding stays under €1 (${totalDeposited})`);
  console.log('✓ Test 6: schedule funds each expense by its due month; rounding never short');

  // 7. due month / overdue → no contribution; savings cover part of it (funded map)
  const dueNow: SavingsBucketInput = {
    id: 'trip',
    kind: 'GOAL',
    ledger: [{ type: 'DEPOSIT', amount: 400, date: d(2026, 8) }],
    pending: [{ id: 'trip1', amount: 1000, expectedDate: d(2026, 9, 28) }],
  };
  const tripMonth = computeSavingsMonth([dueNow], '2026-09', now);
  assert.equal(tripMonth.savingsDue, 0);
  assert.equal(tripMonth.fundedByPlannedId.trip1, 400);
  console.log('✓ Test 7: due month has no contribution; funded part reported for the projection');

  // 8. General: no contribution, deposits and boosts reported; transfers budget-neutral but satisfy due
  const general: SavingsBucketInput = {
    id: 'gen',
    kind: 'GENERAL',
    ledger: [
      { type: 'DEPOSIT', amount: 200, date: d(2026, 9, 3) },
      { type: 'BUDGET_BOOST', amount: -50, date: d(2026, 9, 4) },
      { type: 'TRANSFER_OUT', amount: -875, date: d(2026, 9, 5) },
      { type: 'DEPOSIT', amount: 2000, date: d(2026, 8, 3) },
    ],
    pending: [],
  };
  const carFromGeneral: SavingsBucketInput = {
    ...car,
    ledger: [{ type: 'TRANSFER_IN', amount: 875, date: d(2026, 9, 5) }],
  };
  const month = computeSavingsMonth([general, carFromGeneral], '2026-09', now);
  assert.equal(month.deposited, 200);
  assert.equal(month.boost, 50);
  assert.equal(month.savingsDue, 0, 'a transfer from General satisfies the contribution');
  assert.equal(month.buckets[0].balanceNow, 1275);
  console.log('✓ Test 8: General deposits/boost reported; transfers satisfy due without budget effect');

  // 9. future months are simulated assuming scheduled deposits (single expense → flat contribution)
  const single: SavingsBucketInput = {
    id: 'laptop',
    kind: 'GOAL',
    ledger: [],
    pending: [{ id: 'l', amount: 1200, expectedDate: d(2027, 9) }],
  };
  assert.equal(computeBucketMonth(single, '2026-09', now).contributionDue, 100);
  assert.equal(computeBucketMonth(single, '2027-03', now).contributionDue, 100);
  assert.equal(computeBucketMonth(single, '2027-03', now).balanceStart, 600);
  const futureDue = computeSavingsMonth([single], '2027-09', now);
  assert.equal(futureDue.savingsDue, 0);
  assert.equal(futureDue.fundedByPlannedId.l, 1200);
  // after the due month, the expense is paid in the simulation
  assert.equal(computeBucketMonth(single, '2027-10', now).allocations.length, 0);
  console.log('✓ Test 9: future months simulate scheduled deposits and payment in due month');

  // 10. manual General adjustments change only the balance: no budget effect, no contribution effect
  const adjusted: SavingsBucketInput = {
    id: 'gen2',
    kind: 'GENERAL',
    ledger: [
      { type: 'ADJUSTMENT_IN', amount: 500, date: d(2026, 9, 3) },
      { type: 'ADJUSTMENT_OUT', amount: -200, date: d(2026, 9, 4) },
    ],
    pending: [],
  };
  const adjMonth = computeSavingsMonth([adjusted, car], '2026-09', now);
  assert.equal(adjMonth.buckets[0].balanceNow, 300);
  assert.equal(adjMonth.deposited, 0, 'adjustments are not deposits');
  assert.equal(adjMonth.boost, 0);
  assert.equal(adjMonth.savingsDue, 875, 'car bucket untouched');
  assert.equal(computeBucketMonth({ ...car, ledger: [{ type: 'ADJUSTMENT_IN', amount: 875, date: d(2026, 9, 5) }] }, '2026-09', now).contributed, 0);
  console.log('✓ Test 10: manual adjustments are budget- and contribution-neutral');

  // 11. a closed bucket (no pending expenses) still reports its deposits but never has anything due
  const closed: SavingsBucketInput = {
    id: 'closed',
    kind: 'GOAL',
    ledger: [
      { type: 'DEPOSIT', amount: 400, date: d(2026, 9, 2) },
      { type: 'TRANSFER_OUT', amount: -400, date: d(2026, 9, 3) },
    ],
    pending: [],
  };
  const closedMonth = computeSavingsMonth([closed], '2026-09', now);
  assert.equal(closedMonth.deposited, 400);
  assert.equal(closedMonth.savingsDue, 0);
  console.log('✓ Test 11: closed buckets keep their deposits in the month and have nothing due');

  console.log('\n✅ All savings math tests passed.');
}

try {
  run();
} catch (err) {
  console.error('❌ Savings math test failed:', err);
  process.exit(1);
}
