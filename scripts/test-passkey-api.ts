import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';

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
  return { status: res.status, data, headers: res.headers };
}

function getSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers);
  }
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}

function extractCookie(headers: Headers, name: string): string | null {
  const setCookies = getSetCookies(headers);
  for (const cookieStr of setCookies) {
    const match = cookieStr.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

function isCookieCleared(headers: Headers, name: string): boolean {
  const setCookies = getSetCookies(headers);
  for (const cookieStr of setCookies) {
    if (
      cookieStr.includes(`${name}=`) &&
      (cookieStr.includes('Max-Age=0') || cookieStr.toLowerCase().includes('expires='))
    ) {
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('🧪 Starting Passkey API Integration Tests...');

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const email = `passkey-test-${suffix}@example.com`;
  const password = 'Password123!';

  let fixtureUserId: string | null = null;

  try {
    // 1. Create fixture user with a password
    const fixtureUser = await prisma.user.create({
      data: {
        name: `Passkey Test User ${suffix}`,
        email,
        passwordHash: hashPassword(password),
      },
    });
    fixtureUserId = fixtureUser.id;
    console.log(`  ✓ Created fixture user: ${email} (${fixtureUserId})`);

    // 2. Log in via POST /api/auth/login to get aura_session cookie
    const loginRes = await call('POST', '/api/auth/login', {}, { email, password });
    assert.equal(loginRes.status, 200, `Login should succeed with 200, got ${loginRes.status}`);

    const sessionToken = extractCookie(loginRes.headers, 'aura_session');
    assert.ok(sessionToken, 'Login response must set aura_session cookie');
    const sessionCookie = `aura_session=${sessionToken}`;
    console.log('  ✓ Logged in and extracted aura_session cookie');

    // (a) options without cookie → 401; with only x-user-id header → 401
    const resOptNoCookie = await call('POST', '/api/auth/passkey/register/options');
    assert.equal(
      resOptNoCookie.status,
      401,
      `Options without cookie must return 401, got ${resOptNoCookie.status}`
    );

    const resOptMockOnly = await call('POST', '/api/auth/passkey/register/options', {
      'x-user-id': fixtureUserId,
    });
    assert.equal(
      resOptMockOnly.status,
      401,
      `Options with only x-user-id must return 401, got ${resOptMockOnly.status}`
    );
    console.log('  ✓ (a) options without cookie → 401; with only x-user-id → 401');

    // (b) with cookie → 200, rp.id === 'localhost', authenticatorSelection.residentKey === 'required', set-cookie contains aura_webauthn
    const resOptWithCookie = await call('POST', '/api/auth/passkey/register/options', {
      Cookie: sessionCookie,
    });
    assert.equal(
      resOptWithCookie.status,
      200,
      `Options with cookie must return 200, got ${resOptWithCookie.status}`
    );
    assert.equal(
      resOptWithCookie.data.rp?.id,
      'localhost',
      `rp.id must be 'localhost', got ${resOptWithCookie.data.rp?.id}`
    );
    assert.equal(
      resOptWithCookie.data.authenticatorSelection?.residentKey,
      'required',
      `residentKey must be 'required', got ${resOptWithCookie.data.authenticatorSelection?.residentKey}`
    );

    const challengeToken = extractCookie(resOptWithCookie.headers, 'aura_webauthn');
    assert.ok(
      challengeToken,
      'Set-Cookie on options response must contain aura_webauthn challenge cookie'
    );
    console.log(
      '  ✓ (b.1) options with cookie → 200, rp.id === localhost, residentKey === required, set-cookie contains aura_webauthn'
    );

    // Insert a fixture Passkey row via prisma for the user and assert excludeCredentials contains its credentialId
    const fixtureCredId = `fixture-cred-${suffix}`;
    const fixturePasskey = await prisma.passkey.create({
      data: {
        userId: fixtureUserId,
        credentialId: fixtureCredId,
        publicKey: Buffer.from('fixture-public-key-bytes'),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        name: 'My Fixture Key',
      },
    });
    console.log(`  ✓ Inserted fixture Passkey row: ${fixturePasskey.id}`);

    const resOpt2 = await call('POST', '/api/auth/passkey/register/options', {
      Cookie: sessionCookie,
    });
    assert.equal(resOpt2.status, 200);
    const excludeCredentials = resOpt2.data.excludeCredentials;
    assert.ok(
      Array.isArray(excludeCredentials),
      'excludeCredentials must be an array in registration options'
    );
    assert.ok(
      excludeCredentials.some((c: { id?: string }) => c.id === fixtureCredId),
      `excludeCredentials must contain fixture credentialId ${fixtureCredId}`
    );
    console.log('  ✓ (b.2) excludeCredentials contains user existing passkey credentialId');

    // (c) verify without the challenge cookie → 400; verify with a challenge cookie but garbage body → 400 and the response clears aura_webauthn
    const resVerifyNoChallenge = await call(
      'POST',
      '/api/auth/passkey/register/verify',
      { Cookie: sessionCookie },
      { id: 'random-cred-id', response: {} }
    );
    assert.equal(
      resVerifyNoChallenge.status,
      400,
      `Verify without challenge cookie must return 400, got ${resVerifyNoChallenge.status}`
    );
    assert.equal(
      resVerifyNoChallenge.data.error,
      'Passkey challenge expired, please try again',
      'Verify without challenge cookie must return challenge expired error'
    );

    // Call options to get fresh challenge cookie
    const resOptFresh = await call('POST', '/api/auth/passkey/register/options', {
      Cookie: sessionCookie,
    });
    const freshChallengeToken = extractCookie(resOptFresh.headers, 'aura_webauthn');
    assert.ok(freshChallengeToken, 'Fresh challenge cookie must be issued');
    const freshChallengeCookie = `aura_webauthn=${freshChallengeToken}`;

    const resVerifyGarbage = await call(
      'POST',
      '/api/auth/passkey/register/verify',
      { Cookie: `${sessionCookie}; ${freshChallengeCookie}` },
      { garbage: 'invalid-payload' }
    );
    assert.equal(
      resVerifyGarbage.status,
      400,
      `Verify with garbage body must return 400, got ${resVerifyGarbage.status}`
    );
    assert.equal(
      resVerifyGarbage.data.error,
      'Passkey verification failed',
      'Verify with garbage body must return verification failed'
    );
    assert.ok(
      isCookieCleared(resVerifyGarbage.headers, 'aura_webauthn'),
      'Response must clear aura_webauthn cookie on verification error'
    );
    console.log(
      '  ✓ (c) verify without challenge cookie → 400; verify with challenge cookie + garbage body → 400 and clears aura_webauthn'
    );

    // (d) GET list with cookie → contains the fixture passkey, no publicKey/credentialId fields; without cookie → 401
    const resListNoCookie = await call('GET', '/api/auth/passkeys');
    assert.equal(
      resListNoCookie.status,
      401,
      `GET /api/auth/passkeys without cookie must return 401, got ${resListNoCookie.status}`
    );

    const resListWithCookie = await call('GET', '/api/auth/passkeys', {
      Cookie: sessionCookie,
    });
    assert.equal(
      resListWithCookie.status,
      200,
      `GET /api/auth/passkeys with cookie must return 200, got ${resListWithCookie.status}`
    );
    assert.ok(
      Array.isArray(resListWithCookie.data.passkeys),
      'GET /api/auth/passkeys must return passkeys array'
    );
    const foundPasskey = resListWithCookie.data.passkeys.find(
      (p: { id: string }) => p.id === fixturePasskey.id
    );
    assert.ok(foundPasskey, 'Passkey list must contain the fixture passkey');
    assert.equal(foundPasskey.name, 'My Fixture Key');
    assert.equal(
      foundPasskey.publicKey,
      undefined,
      'Passkey list must never return publicKey'
    );
    assert.equal(
      foundPasskey.credentialId,
      undefined,
      'Passkey list must never return credentialId'
    );
    console.log(
      '  ✓ (d) GET list with cookie contains fixture passkey without publicKey/credentialId; without cookie → 401'
    );

    console.log('🎉 All Passkey API tests passed successfully!');
  } finally {
    if (fixtureUserId) {
      await prisma.passkey.deleteMany({ where: { userId: fixtureUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: fixtureUserId } }).catch(() => {});
      console.log('  ✓ Cleaned up test fixture user and passkeys');
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Passkey API tests failed:', err);
  process.exit(1);
});
