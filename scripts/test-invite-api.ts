import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : {}) as Json };
}

async function main() {
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
    walletMember: await prisma.walletMember.count(),
    walletInvite: await prisma.walletInvite.count(),
    activityLog: await prisma.activityLog.count(),
  });

  const before = await countAll();
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const userIds: string[] = [];
  const walletIds: string[] = [];

  try {
    const mkUser = async (label: string, emailOverride?: string) => {
      const u = await prisma.user.create({
        data: {
          name: `Invite ${label} ${suffix}`,
          email: emailOverride ?? `invite-${label}-${suffix}@example.com`,
        },
      });
      userIds.push(u.id);
      return u;
    };

    const owner = await mkUser('owner');
    const existingUser = await mkUser('existing');
    const joiner = await mkUser('joiner');
    const outsider = await mkUser('outsider');

    const wallet = await prisma.wallet.create({
      data: {
        name: `Invite Test Wallet ${suffix}`,
        monthlyBudget: 1500,
        members: {
          create: [{ userId: owner.id, role: 'OWNER' }],
        },
      },
    });
    walletIds.push(wallet.id);

    const openInvite = await prisma.walletInvite.create({
      data: {
        walletId: wallet.id,
        code: `INV-OPEN-${suffix}`,
        role: 'MEMBER',
      },
    });

    const targetEmail = `specific-${suffix}@example.com`;
    const targetedInvite = await prisma.walletInvite.create({
      data: {
        walletId: wallet.id,
        code: `INV-TARGET-${suffix}`,
        role: 'MEMBER',
        targetEmail,
      },
    });

    // Case a: Anonymous name/email POST with normal auth mode and no x-user-id -> 401
    // a1: Non-existent email -> 401, no User created
    const anonEmail = `anon-${suffix}@example.com`;
    const anonTry = await call(
      'POST',
      `/api/invite/${openInvite.code}`,
      { 'x-auth-mode': 'normal' },
      { name: 'Anonymous Attacker', email: anonEmail }
    );
    assert.equal(anonTry.status, 401);
    const anonUserInDb = await prisma.user.findUnique({ where: { email: anonEmail } });
    assert.equal(anonUserInDb, null, 'No user row should be created for unauthenticated invite acceptance');

    // a2: Existing user email + different name -> 401, existing user not renamed
    const renameTry = await call(
      'POST',
      `/api/invite/${openInvite.code}`,
      { 'x-auth-mode': 'normal' },
      { name: 'Renamed By Attacker', email: existingUser.email }
    );
    assert.equal(renameTry.status, 401);
    const existingUserInDb = await prisma.user.findUnique({ where: { id: existingUser.id } });
    assert.equal(existingUserInDb?.name, existingUser.name, 'Existing user name must not be altered');

    console.log('✓ 1. unauthenticated POST with name/email (normal mode) returns 401; creates/renames no user');

    // Case b: Valid user joins; calling again returns "already a member" with same walletId
    const joinRes = await call(
      'POST',
      `/api/invite/${openInvite.code}`,
      { 'x-user-id': joiner.id }
    );
    assert.ok([200, 201].includes(joinRes.status), `Expected 200/201, got ${joinRes.status}`);
    assert.equal(joinRes.data.walletId, wallet.id);

    const joinerMembership = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: wallet.id, userId: joiner.id } },
    });
    assert.ok(joinerMembership, 'Membership should exist in DB');
    assert.equal(joinerMembership.role, 'MEMBER');

    // Call again with same user -> 200 "already a member"
    const repeatRes = await call(
      'POST',
      `/api/invite/${openInvite.code}`,
      { 'x-user-id': joiner.id }
    );
    assert.equal(repeatRes.status, 200);
    assert.equal(repeatRes.data.walletId, wallet.id);
    assert.match(repeatRes.data.message ?? '', /already a member/i);

    const membershipCount = await prisma.walletMember.count({
      where: { walletId: wallet.id, userId: joiner.id },
    });
    assert.equal(membershipCount, 1, 'Should still have exactly one membership');

    console.log('✓ 2. authenticated POST joins wallet; repeat returns 200 already a member with single membership');

    // Case c: Targeted invite with non-matching user -> 403; matching user -> 200
    const nonMatchingRes = await call(
      'POST',
      `/api/invite/${targetedInvite.code}`,
      { 'x-user-id': outsider.id }
    );
    assert.equal(nonMatchingRes.status, 403);
    const outsiderMembership = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: wallet.id, userId: outsider.id } },
    });
    assert.equal(outsiderMembership, null, 'Non-matching user must not join targeted invite');

    const matchingUser = await mkUser('matching', targetEmail);
    const matchingRes = await call(
      'POST',
      `/api/invite/${targetedInvite.code}`,
      { 'x-user-id': matchingUser.id }
    );
    assert.ok([200, 201].includes(matchingRes.status), `Expected 200/201, got ${matchingRes.status}`);
    assert.equal(matchingRes.data.walletId, wallet.id);
    const matchingMembership = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: wallet.id, userId: matchingUser.id } },
    });
    assert.ok(matchingMembership, 'Matching user should join targeted invite');

    console.log('✓ 3. targeted invite rejects non-matching user with 403; matching user joins successfully');
  } finally {
    if (walletIds.length > 0) {
      await prisma.activityLog.deleteMany({ where: { walletId: { in: walletIds } } });
      await prisma.walletInvite.deleteMany({ where: { walletId: { in: walletIds } } });
      await prisma.walletMember.deleteMany({ where: { walletId: { in: walletIds } } });
      await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const after = await countAll();
    assert.deepEqual(after, before, 'throwaway data removed; pre-existing row counts unchanged');
    await prisma.$disconnect();
  }

  console.log('\n✅ All invite API tests passed; row counts restored.');
}

main().catch(async (err) => {
  console.error('❌ Invite API test failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
