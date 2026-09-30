import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { round2 } from '../src/lib/savings';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(
  method: string,
  path: string,
  userId: string | null,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; data: Json }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

/** A local date `k` months from now, mid-month (never on a month boundary). */
function monthsAhead(k: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + k, 15, 12, 0, 0);
}

async function main() {
  try {
    const probe = await fetch(`${BASE_URL}/api/users`, { signal: AbortSignal.timeout(3000) });
    if (!probe.ok && probe.status !== 401) throw new Error(`status ${probe.status}`);
  } catch {
    console.error(`Server at ${BASE_URL} is unreachable. Please ensure the dev server is running on :3000.`);
    process.exit(1);
  }
  console.log('🧪 Savings API test suite (throwaway wallets, removed afterwards)...\n');

  const countAll = async () => ({
    user: await prisma.user.count(),
    wallet: await prisma.wallet.count(),
    expense: await prisma.expense.count(),
    plannedExpense: await prisma.plannedExpense.count(),
    invoiceBill: await prisma.invoiceBill.count(),
    activityLog: await prisma.activityLog.count(),
    savingsBucket: await prisma.savingsBucket.count(),
    savingsTransaction: await prisma.savingsTransaction.count(),
  });
  const before = await countAll();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const userIds: string[] = [];
  const walletIds: string[] = [];

  try {
    const mkUser = async (label: string) => {
      const u = await prisma.user.create({ data: { name: `Savings ${label} ${suffix}`, email: `sav-${label}-${suffix}@example.com` } });
      userIds.push(u.id);
      return u;
    };
    const owner = await mkUser('owner');
    const member = await mkUser('member');
    const viewer = await mkUser('viewer');
    const outsider = await mkUser('outsider');

    const wallet = await prisma.wallet.create({
      data: {
        name: `Savings Test ${suffix}`,
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: member.id, role: 'MEMBER' },
            { userId: viewer.id, role: 'VIEWER' },
          ],
        },
      },
    });
    walletIds.push(wallet.id);
    const otherWallet = await prisma.wallet.create({
      data: { name: `Savings Other ${suffix}`, members: { create: [{ userId: outsider.id, role: 'OWNER' }] } },
    });
    walletIds.push(otherWallet.id);

    const mkPlanned = (title: string, amount: number, expectedDate: Date, status = 'PENDING') =>
      prisma.plannedExpense.create({
        data: { walletId: wallet.id, userId: owner.id, title, amount, expectedDate, status },
      });
    const down = await mkPlanned('Car down payment', 3000, monthsAhead(6));
    const rest = await mkPlanned('Car remainder', 9000, monthsAhead(24));
    const thisMonth = await mkPlanned('This month', 100, monthsAhead(0));
    const lastMonth = await mkPlanned('Last month', 100, monthsAhead(-1));
    const realized = await mkPlanned('Realized', 100, monthsAhead(3), 'REALIZED');

    // 1. MEMBER creates a bucket from a future planned expense
    const r1 = await call('POST', `/api/planned-expenses/${down.id}/savings`, member.id, { newBucket: { name: 'Car' } });
    assert.equal(r1.status, 200, JSON.stringify(r1.data));
    const carId: string = r1.data.bucket.id;
    assert.equal(r1.data.bucket.kind, 'GOAL');
    assert.equal(r1.data.plannedExpense.savingsBucketId, carId);
    console.log('✓ 1. MEMBER creates a bucket from a future planned expense (bucket + link)');

    // 2. link a second expense to the existing bucket
    const r2 = await call('POST', `/api/planned-expenses/${rest.id}/savings`, owner.id, { bucketId: carId });
    assert.equal(r2.status, 200, JSON.stringify(r2.data));
    console.log('✓ 2. second expense linked to the existing bucket');

    // 3. overview: target, contribution (500 + 375), General exists
    const g = await call('GET', `/api/wallets/${wallet.id}/savings`, viewer.id);
    assert.equal(g.status, 200, JSON.stringify(g.data));
    assert.equal(g.data.buckets.length, 1);
    const car = g.data.buckets[0];
    assert.equal(car.target, 12000);
    assert.equal(car.balance, 0);
    assert.equal(car.contributionDue, 875);
    assert.equal(car.savingsDue, 875);
    assert.deepEqual(car.expenses.map((e: Json) => e.contribution), [500, 375]);
    assert.ok(g.data.general?.id, 'General bucket is created lazily');
    assert.equal(g.data.general.balance, 0);
    const generalId: string = g.data.general.id;
    const again = await call('GET', `/api/wallets/${wallet.id}/savings`, owner.id);
    assert.equal(again.data.general.id, generalId, 'General is not duplicated');
    console.log('✓ 3. overview: target 12000, contribution 875 (500 + 375), single General');

    // 4. validation
    const bad = [
      [thisMonth.id, { newBucket: { name: 'X' } }, 'current-month expense'],
      [lastMonth.id, { newBucket: { name: 'X' } }, 'past-month expense'],
      [realized.id, { newBucket: { name: 'X' } }, 'realized expense'],
      [down.id, { bucketId: generalId }, 'General as link target'],
      [down.id, { newBucket: { name: '   ' } }, 'blank bucket name'],
      [down.id, { newBucket: { name: 'X', color: 'red' } }, 'bad colour'],
      [down.id, {}, 'neither bucketId nor newBucket'],
      [down.id, { bucketId: carId, disposition: { type: 'BUDGET' } }, 'budget disposition'],
    ] as const;
    for (const [pid, body, label] of bad) {
      const r = await call('POST', `/api/planned-expenses/${pid}/savings`, owner.id, body);
      assert.equal(r.status, 400, `${label}: expected 400, got ${r.status} ${JSON.stringify(r.data)}`);
    }
    const foreignBucket = await prisma.savingsBucket.create({ data: { walletId: otherWallet.id, name: 'Foreign' } });
    const rf = await call('POST', `/api/planned-expenses/${rest.id}/savings`, owner.id, { bucketId: foreignBucket.id });
    assert.equal(rf.status, 400, 'other wallet bucket');
    const unlinkUnlinked = await call('DELETE', `/api/planned-expenses/${thisMonth.id}/savings`, owner.id);
    assert.equal(unlinkUnlinked.status, 400);
    console.log('✓ 4. invalid links rejected with 400 (current/past month, realized, General, foreign bucket, bad input)');

    // 5. permissions
    assert.equal((await call('POST', `/api/planned-expenses/${rest.id}/savings`, viewer.id, { bucketId: carId })).status, 403);
    assert.equal((await call('POST', `/api/planned-expenses/${rest.id}/savings`, outsider.id, { bucketId: carId })).status, 403);
    assert.equal((await call('DELETE', `/api/planned-expenses/${rest.id}/savings`, viewer.id)).status, 403);
    assert.equal((await call('GET', `/api/wallets/${wallet.id}/savings`, outsider.id)).status, 403);
    assert.equal(
      (await call('GET', `/api/wallets/${wallet.id}/savings`, null, undefined, { 'x-auth-mode': 'normal' })).status,
      401
    );
    assert.equal((await call('GET', `/api/wallets/${wallet.id}/savings?month=2026-13`, owner.id)).status, 400);
    console.log('✓ 5. VIEWER/outsider 403, unauthenticated 401, bad month 400');

    // 6. unlink: bucket stays while a pending expense remains; closes silently at zero balance
    const u1 = await call('DELETE', `/api/planned-expenses/${rest.id}/savings`, owner.id);
    assert.equal(u1.status, 200);
    assert.equal(u1.data.bucketClosed, false);
    const u2 = await call('DELETE', `/api/planned-expenses/${down.id}/savings`, owner.id);
    assert.equal(u2.status, 200);
    assert.equal(u2.data.bucketClosed, true);
    const afterClose = await call('GET', `/api/wallets/${wallet.id}/savings`, owner.id);
    assert.equal(afterClose.data.buckets.length, 0);
    assert.equal(afterClose.data.closedBuckets.length, 1);
    assert.equal((await call('POST', `/api/planned-expenses/${down.id}/savings`, owner.id, { bucketId: carId })).status, 400, 'closed bucket not linkable');
    console.log('✓ 6. unlink keeps bucket while pending remain; last unlink at €0 closes it silently');

    // 7. leftover requires a disposition; failed request rolls back
    const trip = await call('POST', `/api/planned-expenses/${rest.id}/savings`, owner.id, { newBucket: { name: 'Trip' } });
    const tripId: string = trip.data.bucket.id;
    await prisma.savingsTransaction.create({
      data: { walletId: wallet.id, bucketId: tripId, userId: owner.id, type: 'DEPOSIT', amount: 200, date: new Date() },
    });
    const noDisp = await call('DELETE', `/api/planned-expenses/${rest.id}/savings`, owner.id);
    assert.equal(noDisp.status, 409);
    assert.equal(noDisp.data.error, 'Disposition required');
    assert.equal(noDisp.data.leftover, 200);
    const stillLinked = await prisma.plannedExpense.findUnique({ where: { id: rest.id } });
    assert.equal(stillLinked?.savingsBucketId, tripId, 'rolled back');
    const toGeneral = await call('DELETE', `/api/planned-expenses/${rest.id}/savings`, owner.id, {
      disposition: { type: 'GENERAL' },
    });
    assert.equal(toGeneral.status, 200, JSON.stringify(toGeneral.data));
    const ov = await call('GET', `/api/wallets/${wallet.id}/savings`, owner.id);
    assert.equal(ov.data.general.balance, 200);
    assert.equal(ov.data.general.depositedThisMonth, 0, 'transfer is not a deposit');
    console.log('✓ 7. leftover → 409 + rollback without disposition; GENERAL disposition moves €200');

    // 8. re-linking away from a bucket with leftover → disposition to another bucket
    const a = await call('POST', `/api/planned-expenses/${down.id}/savings`, owner.id, { newBucket: { name: 'A' } });
    const aId: string = a.data.bucket.id;
    await prisma.savingsTransaction.create({
      data: { walletId: wallet.id, bucketId: aId, userId: owner.id, type: 'DEPOSIT', amount: 50, date: new Date() },
    });
    const b = await call('POST', `/api/planned-expenses/${rest.id}/savings`, owner.id, { newBucket: { name: 'B' } });
    const bId: string = b.data.bucket.id;
    const relinkNoDisp = await call('POST', `/api/planned-expenses/${down.id}/savings`, owner.id, { bucketId: bId });
    assert.equal(relinkNoDisp.status, 409);
    const relinkSelf = await call('POST', `/api/planned-expenses/${down.id}/savings`, owner.id, {
      bucketId: bId,
      disposition: { type: 'BUCKET', targetBucketId: aId },
    });
    assert.equal(relinkSelf.status, 400, 'cannot dispose into the closing bucket itself');
    const relink = await call('POST', `/api/planned-expenses/${down.id}/savings`, owner.id, {
      bucketId: bId,
      disposition: { type: 'BUCKET', targetBucketId: bId },
    });
    assert.equal(relink.status, 200, JSON.stringify(relink.data));
    const ov2 = await call('GET', `/api/wallets/${wallet.id}/savings`, owner.id);
    assert.equal(ov2.data.buckets.length, 1);
    assert.equal(ov2.data.buckets[0].id, bId);
    assert.equal(ov2.data.buckets[0].balance, 50);
    assert.equal(ov2.data.buckets[0].target, 12000);
    console.log('✓ 8. re-link away from bucket with leftover: 409, then BUCKET disposition moves €50');

    // 10. PATCH moving a linked expense into the current month unlinks it (bucket B has €50 → disposition)
    const toNow = monthsAhead(0);
    const nowKey = `${toNow.getFullYear()}-${String(toNow.getMonth() + 1).padStart(2, '0')}-15`;
    const patchFuture = await call('PATCH', `/api/planned-expenses/${rest.id}`, owner.id, {
      expectedDate: `${monthsAhead(12).getFullYear()}-${String(monthsAhead(12).getMonth() + 1).padStart(2, '0')}-15`,
    });
    assert.equal(patchFuture.status, 200);
    assert.equal(patchFuture.data.unlinkedFromSavings, false, 'future-month date keeps the link');
    const p1 = await call('PATCH', `/api/planned-expenses/${rest.id}`, owner.id, { expectedDate: nowKey });
    assert.equal(p1.status, 200, JSON.stringify(p1.data));
    assert.equal(p1.data.unlinkedFromSavings, true);
    assert.equal(p1.data.plannedExpense.savingsBucketId, null);
    const p2 = await call('PATCH', `/api/planned-expenses/${down.id}`, owner.id, { expectedDate: nowKey });
    assert.equal(p2.status, 409, 'last expense of bucket with €50 needs a disposition');
    const stillFuture = await prisma.plannedExpense.findUnique({ where: { id: down.id } });
    assert.equal(stillFuture?.savingsBucketId, bId, 'rolled back');
    const p3 = await call('PATCH', `/api/planned-expenses/${down.id}`, owner.id, {
      expectedDate: nowKey,
      disposition: { type: 'GENERAL' },
    });
    assert.equal(p3.status, 200, JSON.stringify(p3.data));
    assert.equal((await prisma.savingsBucket.findUnique({ where: { id: bId } }))?.status, 'CLOSED');
    console.log('✓ 10. PATCH into current month auto-unlinks; last expense with leftover needs disposition');

    // 11. DELETE of the last linked expense with leftover → 409, then disposition; realize closes at €0
    const future1 = await mkPlanned('Laptop', 1200, monthsAhead(4));
    const lap = await call('POST', `/api/planned-expenses/${future1.id}/savings`, owner.id, { newBucket: { name: 'Laptop' } });
    await prisma.savingsTransaction.create({
      data: { walletId: wallet.id, bucketId: lap.data.bucket.id, userId: owner.id, type: 'DEPOSIT', amount: 30, date: new Date() },
    });
    assert.equal((await call('DELETE', `/api/planned-expenses/${future1.id}`, owner.id)).status, 409);
    assert.ok(await prisma.plannedExpense.findUnique({ where: { id: future1.id } }), 'delete rolled back');
    const del = await call('DELETE', `/api/planned-expenses/${future1.id}`, owner.id, { disposition: { type: 'GENERAL' } });
    assert.equal(del.status, 200, JSON.stringify(del.data));
    const future2 = await mkPlanned('Phone', 600, monthsAhead(2));
    const ph = await call('POST', `/api/planned-expenses/${future2.id}/savings`, owner.id, { newBucket: { name: 'Phone' } });
    const realizeRes = await call('POST', `/api/planned-expenses/${future2.id}/realize`, owner.id, {});
    assert.equal(realizeRes.status, 200, JSON.stringify(realizeRes.data));
    assert.equal((await prisma.savingsBucket.findUnique({ where: { id: ph.data.bucket.id } }))?.status, 'CLOSED');
    const gen = await call('GET', `/api/wallets/${wallet.id}/savings`, owner.id);
    assert.equal(gen.data.general.balance, 280, 'General got 200 + 50 + 30');
    console.log('✓ 11. DELETE needs disposition for leftover; realizing the last expense closes a €0 bucket');

    // 13. deposits: count against the month's budget, satisfy the due contribution, lower future months
    const nowD = new Date();
    const curKey = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;
    const nextD = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 1);
    const nextKey = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;
    const tv = await mkPlanned('TV', 1200, monthsAhead(6));
    const tvLink = await call('POST', `/api/planned-expenses/${tv.id}/savings`, owner.id, { newBucket: { name: 'TV' } });
    const tvId: string = tvLink.data.bucket.id;
    const expensesBefore = await prisma.expense.count({ where: { walletId: wallet.id } });
    const w0 = await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id);
    assert.equal(w0.data.metrics.savings.savingsDue, 200, 'TV: 1200 / 6');
    const remaining0: number = w0.data.metrics.remainingBudget;
    const projected0: number = w0.data.metrics.projection.projectedRemaining;
    // Earlier steps deposited into buckets that have closed since; those deposits still count this month.
    const deposited0: number = w0.data.metrics.savings.deposited;

    const dep = await call('POST', `/api/savings/${tvId}/deposit`, member.id, { amount: 200 });
    assert.equal(dep.status, 201, JSON.stringify(dep.data));
    const w1 = await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id);
    assert.equal(round2(w1.data.metrics.savings.deposited - deposited0), 200);
    assert.equal(w1.data.metrics.savings.savingsDue, 0);
    assert.equal(w1.data.metrics.remainingBudget, remaining0 - 200, 'deposit uses budget');
    assert.equal(w1.data.metrics.projection.projectedRemaining, projected0, 'due → deposited: projection unchanged');
    assert.equal(await prisma.expense.count({ where: { walletId: wallet.id } }), expensesBefore, 'no Expense rows');

    const nextBefore = (await call('GET', `/api/wallets/${wallet.id}/savings?month=${nextKey}`, owner.id)).data.buckets
      .find((b: Json) => b.id === tvId).contributionDue;
    assert.equal(nextBefore, 200, 'schedule followed → flat contribution');
    assert.equal((await call('POST', `/api/savings/${tvId}/deposit`, owner.id, { amount: 300 })).status, 201);
    const nextAfter = (await call('GET', `/api/wallets/${wallet.id}/savings?month=${nextKey}`, owner.id)).data.buckets
      .find((b: Json) => b.id === tvId).contributionDue;
    assert.equal(nextAfter, 140, 'extra €300 → (1200 − 500) / 5');
    const w2 = await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id);
    assert.equal(w2.data.metrics.savings.savingsDue, 0, 'extra top-up keeps this month satisfied');
    assert.equal(w2.data.metrics.projection.projectedRemaining, projected0 - 300);

    const genDep = await call('POST', `/api/savings/${generalId}/deposit`, owner.id, { amount: 20 });
    assert.equal(genDep.status, 201);
    const w3 = await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id);
    assert.equal(round2(w3.data.metrics.savings.deposited - deposited0), 520, 'General deposits count too');

    const prevD = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 10);
    const prevDay = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-10`;
    const prevKey = prevDay.slice(0, 7);
    assert.equal((await call('POST', `/api/savings/${tvId}/deposit`, owner.id, { amount: 10, date: prevDay })).status, 201);
    const wPrev = await call('GET', `/api/wallets/${wallet.id}?month=${prevKey}`, owner.id);
    assert.equal(wPrev.data.metrics.savings.deposited, 10, 'past-month deposit attributed to that month');

    const tomorrow = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    for (const [body, status, label] of [
      [{ amount: 0 }, 400, 'zero'],
      [{ amount: -5 }, 400, 'negative'],
      [{ amount: 'abc' }, 400, 'non-numeric'],
      [{ amount: 5, date: tomorrowKey }, 400, 'future date'],
      [{ amount: 5, date: '2026-02-30' }, 400, 'impossible date'],
    ] as const) {
      const r = await call('POST', `/api/savings/${tvId}/deposit`, owner.id, body);
      assert.equal(r.status, status, `${label}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    assert.equal((await call('POST', `/api/savings/${tvId}/deposit`, viewer.id, { amount: 5 })).status, 403);
    assert.equal((await call('POST', `/api/savings/${tvId}/deposit`, outsider.id, { amount: 5 })).status, 403);
    assert.equal((await call('POST', `/api/savings/unknown-bucket/deposit`, owner.id, { amount: 5 })).status, 404);
    assert.equal((await call('POST', `/api/savings/${bId}/deposit`, owner.id, { amount: 5 })).status, 409, 'closed bucket');
    console.log('✓ 13. deposits use budget, satisfy the due amount, lower next month; validation + permissions');

    // 15. General manual add / remove: only General's balance changes (budget, buckets, expenses untouched)
    const snapshot = async () => {
      const w = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data;
      const s = (await call('GET', `/api/wallets/${wallet.id}/savings?month=${curKey}`, owner.id)).data;
      return {
        general: s.general.balance as number,
        buckets: s.buckets.map((b: Json) => [b.id, b.balance, b.contributionDue, b.savingsDue]),
        metrics: [w.metrics.remainingBudget, w.metrics.savings, w.metrics.projection.projectedRemaining, w.metrics.totalSpentMonth],
        expenses: await prisma.expense.count({ where: { walletId: wallet.id } }),
      };
    };
    const s0 = await snapshot();
    const addRes = await call('POST', `/api/savings/${generalId}/adjust`, member.id, { direction: 'IN', amount: 500, note: 'Bonus' });
    assert.equal(addRes.status, 201, JSON.stringify(addRes.data));
    const s1 = await snapshot();
    assert.equal(s1.general, s0.general + 500);
    assert.deepEqual([s1.buckets, s1.metrics, s1.expenses], [s0.buckets, s0.metrics, s0.expenses], 'add is budget-neutral');
    const removeRes = await call('POST', `/api/savings/${generalId}/adjust`, owner.id, { direction: 'OUT', amount: 200 });
    assert.equal(removeRes.status, 201);
    const s2 = await snapshot();
    assert.equal(s2.general, s0.general + 300);
    assert.deepEqual([s2.buckets, s2.metrics, s2.expenses], [s0.buckets, s0.metrics, s0.expenses], 'remove is budget-neutral');
    const txBefore = await prisma.savingsTransaction.count({ where: { walletId: wallet.id } });
    const tooMuch = await call('POST', `/api/savings/${generalId}/adjust`, owner.id, { direction: 'OUT', amount: s2.general + 0.01 });
    assert.equal(tooMuch.status, 400);
    assert.equal(tooMuch.data.error, 'Not enough money in General savings');
    assert.equal(await prisma.savingsTransaction.count({ where: { walletId: wallet.id } }), txBefore, 'nothing written');
    for (const [bucket, body, status, label] of [
      [tvId, { direction: 'IN', amount: 5 }, 400, 'sub-bucket'],
      [generalId, { direction: 'SIDEWAYS', amount: 5 }, 400, 'bad direction'],
      [generalId, { direction: 'IN', amount: 0 }, 400, 'zero amount'],
      [generalId, { direction: 'IN', amount: 5, note: 'x'.repeat(201) }, 400, 'long note'],
    ] as const) {
      const r = await call('POST', `/api/savings/${bucket}/adjust`, owner.id, body);
      assert.equal(r.status, status, `${label}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    assert.equal((await call('POST', `/api/savings/${generalId}/adjust`, viewer.id, { direction: 'IN', amount: 5 })).status, 403);
    const s3 = await snapshot();
    assert.equal(s3.general, s2.general, 'rejected requests changed nothing');
    console.log('✓ 15. General manual add/remove: only General changes; overdraw, sub-bucket, validation, VIEWER rejected');

    // 16. paying a linked expense draws from its bucket first; only the shortfall counts in the month
    const cat = await prisma.category.create({ data: { walletId: wallet.id, name: `Car ${suffix}` } });
    const car1 = await prisma.plannedExpense.create({
      data: { walletId: wallet.id, userId: owner.id, categoryId: cat.id, title: 'Car', amount: 1000, expectedDate: monthsAhead(3) },
    });
    const carB = await call('POST', `/api/planned-expenses/${car1.id}/savings`, owner.id, { newBucket: { name: 'Car' } });
    const carBucketId: string = carB.data.bucket.id;
    await call('POST', `/api/savings/${carBucketId}/deposit`, owner.id, { amount: 1000 });
    const m0 = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.metrics;
    const catSpent0 = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.categories.find(
      (c: Json) => c.id === cat.id
    ).spent;
    const pay = await call('POST', `/api/planned-expenses/${car1.id}/realize`, owner.id, { amount: 1200 });
    assert.equal(pay.status, 200, JSON.stringify(pay.data));
    assert.equal(pay.data.fundedFromSavings, 1000);
    assert.equal(pay.data.expense.savingsFundedAmount, 1000);
    const w5 = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data;
    assert.equal(round2(w5.metrics.totalSpentMonth - m0.totalSpentMonth), 200, 'only the €200 shortfall counts');
    assert.equal(w5.categories.find((c: Json) => c.id === cat.id).spent - catSpent0, 200, 'category uses net (Q1)');
    assert.equal(
      w5.metrics.savings.deposited,
      m0.savings.deposited,
      'deposits of a bucket that just closed still count in their month'
    );
    assert.equal(
      round2(w5.metrics.projection.projectedRemaining - m0.projection.projectedRemaining),
      -200,
      'goal costs the month deposit (already counted) + shortfall only: exactly the €1,200 once'
    );
    const carAfter = await prisma.savingsBucket.findUnique({ where: { id: carBucketId } });
    assert.equal(carAfter?.status, 'CLOSED', 'bucket drained to €0 and closed');
    const draws = await prisma.savingsTransaction.findMany({ where: { bucketId: carBucketId, type: 'EXPENSE_DRAW' } });
    assert.equal(draws.length, 1);
    assert.equal(draws[0].amount, -1000);
    assert.equal(draws[0].expenseId, pay.data.expense.id);

    // cheaper than planned with another pending expense → leftover stays for it; no budget hit
    const tripA = await mkPlanned('Trip flights', 900, monthsAhead(2));
    const tripB = await mkPlanned('Trip hotel', 600, monthsAhead(4));
    const tripLink = await call('POST', `/api/planned-expenses/${tripA.id}/savings`, owner.id, { newBucket: { name: 'Trip' } });
    const tripBucketId: string = tripLink.data.bucket.id;
    await call('POST', `/api/planned-expenses/${tripB.id}/savings`, owner.id, { bucketId: tripBucketId });
    await call('POST', `/api/savings/${tripBucketId}/deposit`, owner.id, { amount: 1000 });
    const m1 = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.metrics;
    const [payA, payA2] = await Promise.all([
      call('POST', `/api/planned-expenses/${tripA.id}/realize`, owner.id, { amount: 850 }),
      call('POST', `/api/planned-expenses/${tripA.id}/realize`, owner.id, { amount: 850 }),
    ]);
    assert.deepEqual([payA.status, payA2.status].sort(), [200, 409], 'concurrent double-realize → one wins');
    const winner = payA.status === 200 ? payA : payA2;
    assert.equal(winner.data.fundedFromSavings, 850);
    const m2 = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.metrics;
    assert.equal(round2(m2.totalSpentMonth - m1.totalSpentMonth), 0, 'fully funded → no budget hit');
    assert.equal(await prisma.savingsTransaction.count({ where: { bucketId: tripBucketId, type: 'EXPENSE_DRAW' } }), 1);
    const tripView = (await call('GET', `/api/wallets/${wallet.id}/savings?month=${curKey}`, owner.id)).data.buckets.find(
      (b: Json) => b.id === tripBucketId
    );
    assert.equal(tripView.balance, 150, 'leftover stays in the bucket');
    assert.equal(tripView.expenses[0].allocated, 150, 'and is allocated to the remaining expense');
    console.log('✓ 16. realize draws from bucket (shortfall-only in budget and category), leftover kept, single draw under race');

    // 17. bucket names are editable (active and closed); General is not; validation + permissions
    const renamed = await call('PATCH', `/api/savings/${tvId}`, member.id, { name: '  Big TV  ' });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.data));
    assert.equal(renamed.data.bucket.name, 'Big TV');
    const tvPlanned = await prisma.plannedExpense.findUnique({ where: { id: tv.id } });
    assert.equal(tvPlanned?.savingsBucketId, tvId, 'links untouched');
    const tvMonth = `${tv.expectedDate.getFullYear()}-${String(tv.expectedDate.getMonth() + 1).padStart(2, '0')}`;
    const wRen = (await call('GET', `/api/wallets/${wallet.id}?month=${tvMonth}`, owner.id)).data;
    assert.equal(wRen.plannedExpenses.find((p: Json) => p.id === tv.id).savingsBucket.name, 'Big TV', 'chip data renamed');
    const sRen = (await call('GET', `/api/wallets/${wallet.id}/savings?month=${curKey}`, owner.id)).data;
    assert.equal(sRen.buckets.find((b: Json) => b.id === tvId).balance, 510, 'balance untouched (200 + 300 + 10)');
    assert.equal((await call('PATCH', `/api/savings/${carBucketId}`, owner.id, { name: 'Old car' })).status, 200, 'closed bucket renamable');
    for (const [bucket, body, status, label] of [
      [tvId, { name: '   ' }, 400, 'blank'],
      [tvId, { name: 'x'.repeat(61) }, 400, 'too long'],
      [tvId, {}, 400, 'missing'],
      [generalId, { name: 'Rainy day' }, 400, 'General'],
    ] as const) {
      const r = await call('PATCH', `/api/savings/${bucket}`, owner.id, body);
      assert.equal(r.status, status, `${label}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    assert.equal((await call('PATCH', `/api/savings/${tvId}`, viewer.id, { name: 'X' })).status, 403);
    assert.equal((await call('PATCH', `/api/savings/${tvId}`, outsider.id, { name: 'X' })).status, 403);
    const custom = await mkPlanned('Washing machine', 700, monthsAhead(5));
    const customLink = await call('POST', `/api/planned-expenses/${custom.id}/savings`, owner.id, { newBucket: { name: 'Appliances' } });
    assert.equal(customLink.data.bucket.name, 'Appliances', 'create uses the typed name, not the title');
    console.log('✓ 17. rename active/closed buckets; General, blank/long, VIEWER, outsider rejected; custom name on create');

    // 18. transfers are budget-neutral; boosts raise only the chosen month's budget, only from General
    const applId: string = customLink.data.bucket.id;
    const tBefore = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.metrics;
    const generalBal = async () =>
      (await call('GET', `/api/wallets/${wallet.id}/savings?month=${curKey}`, owner.id)).data.general.balance as number;
    const g0 = await generalBal();
    const mv = await call('POST', `/api/savings/${tvId}/transfer`, member.id, { toBucketId: applId, amount: 100 });
    assert.equal(mv.status, 201, JSON.stringify(mv.data));
    const mvBack = await call('POST', `/api/savings/${applId}/transfer`, owner.id, { toBucketId: generalId, amount: 40 });
    assert.equal(mvBack.status, 201);
    const tAfter = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.metrics;
    assert.equal(tAfter.remainingBudget, tBefore.remainingBudget, 'transfers do not touch the budget');
    assert.equal(tAfter.savings.deposited, tBefore.savings.deposited);
    assert.equal(round2((await generalBal()) - g0), 40);
    const pair = await prisma.savingsTransaction.findMany({ where: { transferGroupId: { not: null }, bucketId: { in: [tvId, applId] }, type: { in: ['TRANSFER_OUT', 'TRANSFER_IN'] } } });
    assert.ok(pair.length >= 3, 'paired ledger rows');
    for (const [from, body, status, label] of [
      [tvId, { toBucketId: applId, amount: 1_000_000 }, 400, 'more than the balance'],
      [tvId, { toBucketId: tvId, amount: 1 }, 400, 'to itself'],
      [tvId, { toBucketId: bId, amount: 1 }, 400, 'to a closed bucket'],
      [tvId, { toBucketId: foreignBucket.id, amount: 1 }, 400, 'to another wallet'],
      [tvId, { toBucketId: applId, amount: -1 }, 400, 'negative'],
    ] as const) {
      const r = await call('POST', `/api/savings/${from}/transfer`, owner.id, body);
      assert.equal(r.status, status, `transfer ${label}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    assert.equal((await call('POST', `/api/savings/${tvId}/transfer`, viewer.id, { toBucketId: applId, amount: 1 })).status, 403);

    const boost = await call('POST', `/api/savings/${generalId}/boost`, owner.id, { amount: 25 });
    assert.equal(boost.status, 201, JSON.stringify(boost.data));
    const bAfter = (await call('GET', `/api/wallets/${wallet.id}?month=${curKey}`, owner.id)).data.metrics;
    assert.equal(bAfter.savings.boost, round2(tAfter.savings.boost + 25));
    // remainingBudget is floored at €0 (this throwaway wallet is over budget); the projection is not.
    assert.equal(round2(bAfter.projection.budget - tAfter.projection.budget), 0, 'base budget unchanged');
    assert.equal(
      round2(bAfter.projection.projectedRemaining - tAfter.projection.projectedRemaining),
      25,
      'boost raises the month budget'
    );
    const bNext = (await call('GET', `/api/wallets/${wallet.id}?month=${nextKey}`, owner.id)).data.metrics;
    assert.equal(bNext.savings.boost, 0, 'only the chosen month');
    assert.equal((await call('POST', `/api/savings/${tvId}/boost`, owner.id, { amount: 1 })).status, 400, 'sub-bucket cannot boost');
    assert.equal((await call('POST', `/api/savings/${generalId}/boost`, owner.id, { amount: 1_000_000 })).status, 400, 'boost > balance');
    assert.equal((await call('POST', `/api/savings/${generalId}/boost`, viewer.id, { amount: 1 })).status, 403);
    console.log('✓ 18. transfers budget-neutral with validation; boost only from General, only that month, never above balance');

    // 19. ledger invariant under 200 random operations: no negative balance, API balances == ledger sums
    const pool = [generalId, tvId, applId];
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let accepted = 0;
    for (let i = 0; i < 200; i++) {
      const from = pool[Math.floor(rand() * pool.length)];
      const amount = round2(1 + rand() * 150);
      const op = Math.floor(rand() * 4);
      let r;
      if (op === 0) r = await call('POST', `/api/savings/${from}/deposit`, owner.id, { amount });
      else if (op === 1) {
        const to = pool.filter((p) => p !== from)[Math.floor(rand() * 2)];
        r = await call('POST', `/api/savings/${from}/transfer`, owner.id, { toBucketId: to, amount });
      } else if (op === 2) r = await call('POST', `/api/savings/${generalId}/adjust`, owner.id, { direction: rand() < 0.5 ? 'IN' : 'OUT', amount });
      else r = await call('POST', `/api/savings/${generalId}/boost`, owner.id, { amount });
      assert.ok([201, 400].includes(r.status), `op ${i}: unexpected ${r.status} ${JSON.stringify(r.data)}`);
      if (r.status === 201) accepted++;
    }
    const overview = (await call('GET', `/api/wallets/${wallet.id}/savings?month=${curKey}`, owner.id)).data;
    const apiBalances: Record<string, number> = {
      [generalId]: overview.general.balance,
      ...Object.fromEntries(overview.buckets.map((b: Json) => [b.id, b.balance])),
    };
    for (const id of pool) {
      const agg = await prisma.savingsTransaction.aggregate({ where: { bucketId: id }, _sum: { amount: true } });
      const ledger = round2(agg._sum.amount ?? 0);
      assert.ok(ledger >= 0, `negative balance in ${id}: ${ledger}`);
      assert.equal(apiBalances[id], ledger, `API balance matches ledger for ${id}`);
    }
    const groups = await prisma.savingsTransaction.groupBy({
      by: ['transferGroupId'],
      where: { walletId: wallet.id, transferGroupId: { not: null } },
      _sum: { amount: true },
    });
    assert.ok(groups.every((g) => round2(g._sum.amount ?? 0) === 0), 'every transfer pair nets to zero');
    assert.ok(accepted > 50 && accepted < 200, `mix of accepted/rejected ops (${accepted})`);
    console.log(`✓ 19. ledger invariant after 200 random ops (${accepted} accepted): no negatives, balances == ledger, pairs net 0`);

    // 14. activity log entries
    const actions = new Set(
      (await prisma.activityLog.findMany({ where: { walletId: wallet.id }, select: { action: true } })).map((l) => l.action)
    );
    for (const action of [
      'SAVINGS_BUCKET_CREATED',
      'PLANNED_EXPENSE_LINKED',
      'PLANNED_EXPENSE_UNLINKED',
      'SAVINGS_BUCKET_CLOSED',
      'SAVINGS_DEPOSIT',
      'SAVINGS_GENERAL_ADJUSTED',
      'SAVINGS_BUCKET_RENAMED',
      'SAVINGS_TRANSFER',
      'SAVINGS_BUDGET_BOOST',
    ]) {
      assert.ok(actions.has(action), `missing activity ${action}`);
    }
    console.log('✓ 14. activity log records create/link/unlink/close/deposit/adjust');
  } finally {
    await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    const after = await countAll();
    assert.deepEqual(after, before, 'throwaway data removed; pre-existing row counts unchanged');
    await prisma.$disconnect();
  }
  console.log('\n✅ All savings API tests passed; row counts restored.');
}

main().catch(async (err) => {
  console.error('❌ Savings API test failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
