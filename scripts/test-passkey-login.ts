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
  let data: Json = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }
  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie') || ''];
  return { status: res.status, data, headers: res.headers, setCookies };
}

async function runTests(): Promise<void> {
  console.log('🧪 Running passkey login API integration tests...');

  // Probe server
  try {
    const probe = await fetch(`${BASE_URL}/api/health`);
    if (probe.status !== 200 && probe.status !== 404) {
      throw new Error(`status ${probe.status}`);
    }
  } catch {
    console.error(`Dev server at ${BASE_URL} is unreachable. Skipping HTTP tests.`);
    process.exit(1);
  }

  // (a) login/options → 200, rpId 'localhost', allowCredentials empty/absent, userVerification 'preferred', set-cookie aura_webauthn
  console.log('  Testing (a): POST /api/auth/passkey/login/options...');
  const resA = await call('POST', '/api/auth/passkey/login/options');
  assert.equal(resA.status, 200, `login/options should return 200, got ${resA.status}`);
  assert.equal(resA.data.rpId, 'localhost', `Expected rpId 'localhost', got ${resA.data.rpId}`);
  assert.ok(
    !resA.data.allowCredentials || resA.data.allowCredentials.length === 0,
    'allowCredentials should be empty or absent'
  );
  assert.equal(resA.data.userVerification, 'preferred');

  const auraCookieA = resA.setCookies.find((c) => c.startsWith('aura_webauthn='));
  assert.ok(auraCookieA, 'Expected aura_webauthn in set-cookie headers');
  const cookieValA = auraCookieA.split(';')[0]; // aura_webauthn=<token>
  console.log('  ✓ (a) options returned 200, rpId localhost, empty allowCredentials, preferred userVerification, set-cookie aura_webauthn');

  // (b) login/verify without challenge cookie → 400
  console.log('  Testing (b): POST /api/auth/passkey/login/verify without challenge cookie...');
  const resB = await call('POST', '/api/auth/passkey/login/verify', {}, {
    id: 'random-cred-id',
    rawId: 'random-cred-id',
    response: {
      clientDataJSON: Buffer.from('{}').toString('base64url'),
      authenticatorData: Buffer.from('{}').toString('base64url'),
      signature: Buffer.from('sig').toString('base64url'),
    },
    type: 'public-key',
  });
  assert.equal(resB.status, 400, `login/verify without cookie should return 400, got ${resB.status}`);
  assert.equal(resB.data.error, 'Passkey challenge expired, please try again');
  console.log('  ✓ (b) verify without challenge cookie returned 400 with expected error');

  // (c) with the challenge cookie from (a) but an unknown credential id body → 401, and the response clears aura_webauthn
  console.log('  Testing (c): POST /api/auth/passkey/login/verify with challenge cookie and unknown credential id...');
  const resC = await call(
    'POST',
    '/api/auth/passkey/login/verify',
    { Cookie: cookieValA },
    {
      id: 'unknown-credential-id-12345',
      rawId: 'unknown-credential-id-12345',
      response: {
        clientDataJSON: Buffer.from('{}').toString('base64url'),
        authenticatorData: Buffer.from('{}').toString('base64url'),
        signature: Buffer.from('sig').toString('base64url'),
      },
      type: 'public-key',
    }
  );
  assert.equal(resC.status, 401, `login/verify with unknown credential should return 401, got ${resC.status}`);
  assert.equal(resC.data.error, 'Passkey not recognised');

  const clearCookieC = resC.setCookies.find((c) => c.startsWith('aura_webauthn='));
  assert.ok(clearCookieC, 'Expected response to clear aura_webauthn cookie');
  assert.ok(
    clearCookieC.includes('Max-Age=0') || /Expires=Thu, 01 Jan 1970/i.test(clearCookieC),
    `Expected aura_webauthn to have Max-Age=0 or past expires, got: ${clearCookieC}`
  );
  console.log('  ✓ (c) verify with unknown credential returned 401 and cleared aura_webauthn cookie');

  // (d) Replay and fixture assertion
  // A challenge cookie is single-use on the server (consumeChallenge in src/lib/webauthn.ts), so
  // re-sending the cookie already used in (c) is rejected before any signature check.
  console.log('  Testing (d): Fixture passkey and replay / garbage assertion rejection...');
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  let fixtureUserId: string | null = null;
  let fixturePasskeyId: string | null = null;
  const initialCounter = 7;

  try {
    const fixtureUser = await prisma.user.create({
      data: {
        name: `Passkey Test User ${suffix}`,
        email: `passkey-test-${suffix}@example.com`,
      },
    });
    fixtureUserId = fixtureUser.id;

    // Create a fixture Passkey with arbitrary public key bytes
    const fixtureCredId = `fixture-cred-${suffix}`;
    const fixturePasskey = await prisma.passkey.create({
      data: {
        userId: fixtureUser.id,
        credentialId: fixtureCredId,
        publicKey: Buffer.from('dummy-public-key-bytes-for-test'),
        counter: initialCounter,
        deviceType: 'singleDevice',
        name: 'Fixture Test Key',
      },
    });
    fixturePasskeyId = fixturePasskey.id;

    // Test 1: Reusing cookieValA (which was already cleared in test c) with the fixture credential
    const resReplay = await call(
      'POST',
      '/api/auth/passkey/login/verify',
      { Cookie: cookieValA },
      {
        id: fixtureCredId,
        rawId: fixtureCredId,
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.get',
            challenge: 'stale-or-replayed-challenge',
            origin: 'http://localhost:3000',
          })).toString('base64url'),
          authenticatorData: Buffer.from('invalid-authenticator-data').toString('base64url'),
          signature: Buffer.from('invalid-signature').toString('base64url'),
        },
        type: 'public-key',
      }
    );
    assert.equal(resReplay.status, 400, `Replayed challenge must return 400, got ${resReplay.status}`);
    assert.equal(resReplay.data.error, 'Passkey challenge expired, please try again');

    // Verify counter is completely unchanged
    const passkeyAfterReplay = await prisma.passkey.findUnique({
      where: { id: fixturePasskeyId },
    });
    assert.equal(
      passkeyAfterReplay?.counter,
      initialCounter,
      `Passkey counter must remain ${initialCounter}, got ${passkeyAfterReplay?.counter}`
    );
    assert.equal(
      passkeyAfterReplay?.lastUsedAt,
      null,
      'lastUsedAt must remain null after rejected assertion'
    );
    console.log('  ✓ (d) replayed challenge cookie rejected with 400; counter unchanged');

    // Test 2: Fresh options challenge with garbage assertion for fixture passkey
    const resFreshOptions = await call('POST', '/api/auth/passkey/login/options');
    assert.equal(resFreshOptions.status, 200);
    const freshCookieHeader = resFreshOptions.setCookies.find((c) => c.startsWith('aura_webauthn='));
    assert.ok(freshCookieHeader);
    const freshCookieVal = freshCookieHeader.split(';')[0];

    const resFreshGarbage = await call(
      'POST',
      '/api/auth/passkey/login/verify',
      { Cookie: freshCookieVal },
      {
        id: fixtureCredId,
        rawId: fixtureCredId,
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.get',
            challenge: resFreshOptions.data.challenge,
            origin: 'http://localhost:3000',
          })).toString('base64url'),
          authenticatorData: Buffer.from('invalid-authenticator-data').toString('base64url'),
          signature: Buffer.from('invalid-signature').toString('base64url'),
        },
        type: 'public-key',
      }
    );
    assert.equal(resFreshGarbage.status, 401, `Invalid cryptographic assertion must return 401, got ${resFreshGarbage.status}`);
    assert.equal(resFreshGarbage.data.error, 'Passkey not recognised');

    // Verify counter still unchanged
    const passkeyAfterFresh = await prisma.passkey.findUnique({
      where: { id: fixturePasskeyId },
    });
    assert.equal(passkeyAfterFresh?.counter, initialCounter);
    assert.equal(passkeyAfterFresh?.lastUsedAt, null);

    // Verify the response also cleared aura_webauthn cookie
    const clearCookieFresh = resFreshGarbage.setCookies.find((c) => c.startsWith('aura_webauthn='));
    assert.ok(clearCookieFresh, 'Response must clear aura_webauthn on verification failure');
    assert.ok(clearCookieFresh.includes('Max-Age=0') || /Expires=Thu, 01 Jan 1970/i.test(clearCookieFresh));
    console.log('  ✓ (d) fresh challenge with invalid signature returned 401, cleared cookie, counter unchanged');
  } finally {
    // Clean up fixture data
    if (fixturePasskeyId) {
      await prisma.passkey.deleteMany({ where: { id: fixturePasskeyId } });
    }
    if (fixtureUserId) {
      await prisma.user.deleteMany({ where: { id: fixtureUserId } });
    }
    console.log('  ✓ Cleaned up fixture user and passkey records');
  }

  console.log('🎉 All passkey login API tests passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
