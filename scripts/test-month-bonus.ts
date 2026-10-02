import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { effectiveBudget, sumBonusForMonth } from '../src/lib/month-bonus';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: string, path: string, userId: string | null, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-user-id': userId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : {}) as Json };
}

async function main() {
  // Pure math
  const list = [
    { monthKey: '2026-09', amount: 100 },
    { monthKey: '2026-09', amount: 50.25 },
    { monthKey: '2026-10', amount: 999 },
  ];
  assert.equal(sumBonusForMonth(list, '2026-09'), 150.25);
  assert.equal(sumBonusForMonth(list, '2026-08'), 0);
  assert.equal(effectiveBudget({ monthlyBudget: 2000, boost: 100, bonus: 150.25 }), 2250.25);
  assert.equal(effectiveBudget({ monthlyBudget: 2000 }), 2000);
  console.log('✓ 1. bonus math: month-scoped sum and effective budget');

  try {
    const probe = await fetch(`${BASE_URL}/api/users`, { signal: AbortSignal.timeout(3000) });
    if (!probe.ok && probe.status !== 401) throw new Error(`status ${probe.status}`);
  } catch {
    console.error(`Server at ${BASE_URL} is unreachable. Please ensure the dev server is running on :3000.`);
    process.exit(1);
  }

  const countAll = async () => ({
    user: await prisma.user.count(),
    wallet: await prisma.wallet.count(),
    expense: await prisma.expense.count(),
    activityLog: await prisma.activityLog.count(),
    monthBonus: await prisma.monthBonus.count(),
  });
  const before = await countAll();
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const userIds: string[] = [];
  const walletIds: string[] = [];

  try {
    const mkUser = async (label: string) => {
      const u = await prisma.user.create({ data: { name: `Bonus ${label} ${suffix}`, email: `bonus-${label}-${suffix}@example.com` } });
      userIds.push(u.id);
      return u;
    };
    const owner = await mkUser('owner');
    const member = await mkUser('member');
    const viewer = await mkUser('viewer');
    const outsider = await mkUser('outsider');

    const mkWallet = async (name: string, ownerId: string, extra: { id: string; role: string }[] = []) => {
      const w = await prisma.wallet.create({
        data: {
          name: `${name} ${suffix}`,
          monthlyBudget: 1000,
          members: { create: [{ userId: ownerId, role: 'OWNER' }, ...extra.map((m) => ({ userId: m.id, role: m.role }))] },
        },
      });
      walletIds.push(w.id);
      return w;
    };
    const wallet = await mkWallet('Bonus Test', owner.id, [
      { id: member.id, role: 'MEMBER' },
      { id: viewer.id, role: 'VIEWER' },
    ]);
    const otherWallet = await mkWallet('Bonus Other', outsider.id);

    const get = (m: string, uid = owner.id) => call('GET', `/api/wallets/${wallet.id}?month=${m}`, uid);

    // Baseline
    const base = await get('2026-09');
    assert.equal(base.status, 200);
    assert.equal(base.data.metrics.bonus, 0);
    const baseRemaining = base.data.metrics.remainingBudget;

    // Permissions & validation
    const post = (uid: string | null, body: unknown) => call('POST', `/api/wallets/${wallet.id}/bonuses`, uid, body);
    assert.ok([401, 403].includes((await post(null, { amount: 10, month: '2026-09' })).status), 'unauthenticated cannot add');
    assert.equal((await post(outsider.id, { amount: 10, month: '2026-09' })).status, 403);
    assert.equal((await post(viewer.id, { amount: 10, month: '2026-09' })).status, 403);
    const memberTry = await post(member.id, { amount: 10, month: '2026-09' });
    assert.equal(memberTry.status, 403);
    assert.equal(memberTry.data.error, 'Only the wallet owner can manage bonuses');
    assert.equal((await post(owner.id, { amount: 0, month: '2026-09' })).status, 400);
    assert.equal((await post(owner.id, { amount: -5, month: '2026-09' })).status, 400);
    assert.equal((await post(owner.id, { amount: 'abc', month: '2026-09' })).status, 400);
    assert.equal((await post(owner.id, { amount: 10, month: '2026-13' })).status, 400);
    assert.equal((await post(owner.id, { amount: 10 })).status, 400);
    assert.equal((await post(owner.id, { amount: 10, month: '2026-09', label: 'x'.repeat(81) })).status, 400);
    assert.equal(await prisma.monthBonus.count({ where: { walletId: wallet.id } }), 0, 'rejected requests store nothing');
    console.log('✓ 2. only OWNER may add; invalid amount/month/label rejected');

    // Add two bonuses to Sept
    const b1 = await post(owner.id, { amount: 200, month: '2026-09', label: '  Christmas  ' });
    assert.equal(b1.status, 201);
    assert.equal(b1.data.bonus.label, 'Christmas');
    const b2 = await post(owner.id, { amount: 50.5, month: '2026-09' });
    assert.equal(b2.status, 201);
    assert.equal(b2.data.bonus.label, null);

    const sept = await get('2026-09');
    assert.equal(sept.data.metrics.bonus, 250.5);
    assert.equal(sept.data.metrics.monthlyBudget, 1000, 'baseline untouched');
    assert.equal(sept.data.wallet.monthlyBudget, 1000);
    assert.equal(sept.data.metrics.remainingBudget, Math.round((baseRemaining + 250.5) * 100) / 100);
    assert.equal(sept.data.metrics.projection.bonus, 250.5);
    assert.equal(
      Math.round((sept.data.metrics.projection.projectedRemaining - base.data.metrics.projection.projectedRemaining) * 100) / 100,
      250.5
    );
    assert.equal(sept.data.bonuses.length, 2);
    // Members can read the bonuses
    assert.equal((await get('2026-09', member.id)).data.metrics.bonus, 250.5);
    // Other month unaffected
    const oct = await get('2026-10');
    assert.equal(oct.data.metrics.bonus, 0);
    assert.equal(oct.data.bonuses.length, 0);
    console.log('✓ 3. bonuses raise only their month; baseline unchanged; members can read');

    // Delete: permissions, scoping
    const del = (uid: string | null, wid: string, bid: string) => call('DELETE', `/api/wallets/${wid}/bonuses/${bid}`, uid);
    const id1 = b1.data.bonus.id as string;
    assert.ok([401, 403].includes((await del(null, wallet.id, id1)).status), 'unauthenticated cannot delete');
    assert.equal((await del(member.id, wallet.id, id1)).status, 403);
    assert.equal((await del(viewer.id, wallet.id, id1)).status, 403);
    assert.equal((await del(outsider.id, otherWallet.id, id1)).status, 404, 'bonus of another wallet is not reachable');
    assert.equal((await del(owner.id, wallet.id, 'does-not-exist')).status, 404);
    assert.equal(await prisma.monthBonus.count({ where: { walletId: wallet.id } }), 2);
    assert.equal((await del(owner.id, wallet.id, id1)).status, 200);
    assert.equal((await get('2026-09')).data.metrics.bonus, 50.5);
    console.log('✓ 4. delete is OWNER-only and wallet-scoped; totals update');

    // Export / import round-trip
    const exp = await call('GET', `/api/wallets/${wallet.id}/export`, owner.id);
    assert.equal(exp.status, 200);
    assert.equal(exp.data.version, '2.3');
    assert.equal(exp.data.monthBonuses.length, 1);
    assert.equal(exp.data.monthBonuses[0].monthKey, '2026-09');
    assert.equal(exp.data.monthBonuses[0].amount, 50.5);

    const target = await mkWallet('Bonus Import', owner.id);
    const imp = await call('POST', `/api/wallets/${target.id}/import`, owner.id, exp.data);
    assert.equal(imp.status, 200);
    assert.equal(imp.data.imported.monthBonuses, 1);
    const imported = await prisma.monthBonus.findMany({ where: { walletId: target.id } });
    assert.equal(imported.length, 1);
    assert.equal(imported[0].amount, 50.5);
    assert.equal(imported[0].monthKey, '2026-09');

    // Older (2.1) file without bonuses, and garbage entries, import fine / are skipped
    const { monthBonuses: _omitted, ...legacyBase } = exp.data; // eslint-disable-line @typescript-eslint/no-unused-vars
    const legacy = { ...legacyBase, version: '2.1' };
    const impOld = await call('POST', `/api/wallets/${target.id}/import`, owner.id, legacy);
    assert.equal(impOld.status, 200);
    assert.equal(impOld.data.imported.monthBonuses, 0);
    const impBad = await call('POST', `/api/wallets/${target.id}/import`, owner.id, {
      ...legacy,
      monthBonuses: [
        { monthKey: 'nope', amount: 10 },
        { monthKey: '2026-09', amount: -3 },
        { monthKey: '2026-09', amount: 12, label: 'ok' },
      ],
    });
    assert.equal(impBad.data.imported.monthBonuses, 1, 'invalid bonus entries are skipped');
    console.log('✓ 5. export 2.3 round-trips bonuses; 2.1 files and invalid entries are handled');

    // Activity log
    const logs = await prisma.activityLog.findMany({ where: { walletId: wallet.id } });
    const actions = new Set(logs.map((l) => l.action));
    assert.ok(actions.has('BONUS_ADDED') && actions.has('BONUS_REMOVED'));
    console.log('✓ 6. activity log records add and remove');
  } finally {
    await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    const after = await countAll();
    assert.deepEqual(after, before, 'throwaway data removed; pre-existing row counts unchanged');
    await prisma.$disconnect();
  }
  console.log('\n✅ All month bonus tests passed; row counts restored.');
}

main().catch(async (err) => {
  console.error('❌ Month bonus test failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
