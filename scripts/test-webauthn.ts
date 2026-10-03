import assert from 'node:assert/strict';
import {
  signChallenge,
  verifyChallenge,
  getRelyingParty,
  toBase64Url,
  fromBase64Url,
  defaultPasskeyName,
  parseTransports,
  CHALLENGE_TTL_MS,
  readChallengeCookie,
  consumeChallenge,
  WEBAUTHN_COOKIE_NAME,
} from '../src/lib/webauthn';

function run() {
  console.log('🧪 Starting WebAuthn helper test suite...\n');

  // Test 1: sign/verify round-trip
  const now = 1700000000000;
  const token = signChallenge({ challenge: 'test-challenge-abc', purpose: 'login' }, now);
  assert.ok(typeof token === 'string' && token.includes('.'));
  const verified = verifyChallenge(token, 'login', now + 1000);
  assert.deepEqual(verified, {
    challenge: 'test-challenge-abc',
    userId: undefined,
  });
  console.log('✓ Test 1: sign/verify round-trip');

  // Test 2: tampered payload
  const [payloadBase64, signature] = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ challenge: 'forged-challenge', purpose: 'login', exp: now + CHALLENGE_TTL_MS })
  ).toString('base64url');
  const tamperedPayloadToken = `${tamperedPayload}.${signature}`;
  assert.equal(verifyChallenge(tamperedPayloadToken, 'login', now + 1000), null);
  console.log('✓ Test 2: tampered payload rejected');

  // Test 3: tampered signature
  const badSig = signature.slice(0, -2) + (signature.endsWith('a') ? 'b' : 'a') + signature.slice(-1);
  const tamperedSigToken = `${payloadBase64}.${badSig}`;
  assert.equal(verifyChallenge(tamperedSigToken, 'login', now + 1000), null);
  assert.equal(verifyChallenge(token + 'extra', 'login', now + 1000), null);
  assert.equal(verifyChallenge('not-a-token', 'login', now + 1000), null);
  assert.equal(verifyChallenge(null, 'login', now + 1000), null);
  assert.equal(verifyChallenge(undefined, 'login', now + 1000), null);
  console.log('✓ Test 3: tampered signature and malformed tokens rejected');

  // Test 4: expired (now + 6 min)
  const sixMinutesLater = now + 6 * 60 * 1000;
  assert.equal(verifyChallenge(token, 'login', sixMinutesLater), null);
  const fourMinutesLater = now + 4 * 60 * 1000;
  assert.ok(verifyChallenge(token, 'login', fourMinutesLater));
  console.log('✓ Test 4: expired challenge rejected after TTL');

  // Test 5: wrong purpose
  const registerToken = signChallenge({ challenge: 'reg-challenge', purpose: 'register' }, now);
  assert.equal(verifyChallenge(registerToken, 'login', now + 1000), null);
  assert.equal(verifyChallenge(token, 'register', now + 1000), null);
  console.log('✓ Test 5: wrong purpose rejected');

  // Test 6: userId preserved
  const userToken = signChallenge(
    { challenge: 'reg-chal-456', purpose: 'register', userId: 'user_clx9999abc' },
    now
  );
  const userVerified = verifyChallenge(userToken, 'register', now + 1000);
  assert.deepEqual(userVerified, {
    challenge: 'reg-chal-456',
    userId: 'user_clx9999abc',
  });
  console.log('✓ Test 6: userId preserved on verification');

  // Test 7: getRelyingParty dev defaults (localhost / http://localhost:3000)
  const devRp = getRelyingParty({});
  assert.equal(devRp.rpID, 'localhost');
  assert.equal(devRp.origin, 'http://localhost:3000');
  assert.equal(devRp.rpName, 'Aura Budget');
  console.log('✓ Test 7: getRelyingParty dev defaults');

  // Test 8: PUBLIC_BASE_URL https://budget.lnf.gr -> rpID budget.lnf.gr
  const prodBaseRp = getRelyingParty({
    PUBLIC_BASE_URL: 'https://budget.lnf.gr',
  });
  assert.equal(prodBaseRp.rpID, 'budget.lnf.gr');
  assert.equal(prodBaseRp.origin, 'https://budget.lnf.gr');

  // Trims trailing slashes
  const prodBaseSlash = getRelyingParty({
    PUBLIC_BASE_URL: 'https://budget.lnf.gr///',
  });
  assert.equal(prodBaseSlash.origin, 'https://budget.lnf.gr');
  assert.equal(prodBaseSlash.rpID, 'budget.lnf.gr');
  console.log('✓ Test 8: PUBLIC_BASE_URL derives rpID and trims slashes');

  // Test 9: explicit overrides
  const overrideRp = getRelyingParty({
    WEBAUTHN_ORIGIN: 'https://auth.custom.com:8443/',
    WEBAUTHN_RP_ID: 'custom.com',
  });
  assert.equal(overrideRp.origin, 'https://auth.custom.com:8443');
  assert.equal(overrideRp.rpID, 'custom.com');
  console.log('✓ Test 9: explicit WEBAUTHN_ORIGIN and WEBAUTHN_RP_ID overrides');

  // Test 10: production with http origin throws
  assert.throws(
    () =>
      getRelyingParty({
        NODE_ENV: 'production',
        PUBLIC_BASE_URL: 'http://budget.lnf.gr',
      }),
    /WebAuthn origin must use HTTPS in production/
  );
  assert.throws(
    () =>
      getRelyingParty({
        NODE_ENV: 'production',
        WEBAUTHN_ORIGIN: 'http://budget.lnf.gr',
      }),
    /WebAuthn origin must use HTTPS in production/
  );
  assert.throws(
    () =>
      getRelyingParty({
        NODE_ENV: 'production',
      }),
    /PUBLIC_BASE_URL must be set in production/
  );
  console.log('✓ Test 10: production enforces HTTPS origin and required config');

  // Test 11: base64url round-trip
  const testBytes = new Uint8Array([0, 1, 2, 42, 128, 200, 255]);
  const b64 = toBase64Url(testBytes);
  const restoredBytes = fromBase64Url(b64);
  assert.deepEqual(Array.from(restoredBytes), Array.from(testBytes));
  assert.equal(toBase64Url(new Uint8Array([])), '');
  assert.equal(fromBase64Url('').length, 0);
  console.log('✓ Test 11: base64url encoding and decoding round-trip');

  // Test 12: defaultPasskeyName samples
  const uaChromeMac =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  assert.equal(defaultPasskeyName(uaChromeMac), 'Chrome on macOS');

  const uaSafariIPhone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  assert.equal(defaultPasskeyName(uaSafariIPhone), 'Safari on iPhone');

  const uaEdgeWindows =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  assert.equal(defaultPasskeyName(uaEdgeWindows), 'Edge on Windows');

  const uaFirefoxAndroid =
    'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';
  assert.equal(defaultPasskeyName(uaFirefoxAndroid), 'Firefox on Android');

  // Fallbacks
  assert.equal(defaultPasskeyName(null), 'Passkey');
  assert.equal(defaultPasskeyName(undefined), 'Passkey');
  assert.equal(defaultPasskeyName(''), 'Passkey');
  assert.equal(defaultPasskeyName('curl/7.88.1'), 'Passkey');
  console.log('✓ Test 12: defaultPasskeyName samples and fallbacks');

  // Test 13: parseTransports helper
  assert.deepEqual(parseTransports('["internal", "hybrid"]'), ['internal', 'hybrid']);
  assert.deepEqual(parseTransports('["usb"]'), ['usb']);
  assert.equal(parseTransports(null), undefined);
  assert.equal(parseTransports(undefined), undefined);
  assert.equal(parseTransports(''), undefined);
  assert.equal(parseTransports('not-json'), undefined);
  assert.equal(parseTransports('[]'), undefined);
  assert.equal(parseTransports('["unknown-future"]'), undefined);
  console.log('✓ Test 13: parseTransports JSON parser');

  // Test 14: a challenge cookie is accepted once only
  const secret14 = 'test-secret-14';
  const cookie14 = signChallenge({ challenge: 'one-shot', purpose: 'login' }, Date.now(), secret14);
  const req14 = { cookies: { get: (name: string) => (name === WEBAUTHN_COOKIE_NAME ? { value: cookie14 } : undefined) } };
  assert.ok(readChallengeCookie(req14, 'login', Date.now(), secret14));
  assert.equal(readChallengeCookie(req14, 'login', Date.now(), secret14), null);
  const t0 = Date.now();
  assert.equal(consumeChallenge('expiring', t0), true);
  assert.equal(consumeChallenge('expiring', t0 + 1000), false);
  assert.equal(consumeChallenge('expiring', t0 + CHALLENGE_TTL_MS + 1), true);
  console.log('✓ Test 14: challenges are single-use until they expire');

  console.log('\n🎉 All WebAuthn tests passed!');
}

run();
