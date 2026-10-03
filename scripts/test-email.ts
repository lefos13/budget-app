import assert from 'node:assert/strict';
import {
  getEmailProvider,
  isEmailDeliveryEnabled,
  getEmailConfigIssue,
  buildTransportOptions,
  getPublicBaseUrl,
  sendEmail,
} from '../src/lib/email';

async function run() {
  console.log('🧪 Starting email service test suite...\n');

  // Test 1: Provider selection
  assert.equal(getEmailProvider({}), 'smtp');
  assert.equal(getEmailProvider({ EMAIL_PROVIDER: 'gmail' }), 'gmail');
  assert.equal(getEmailProvider({ EMAIL_PROVIDER: 'GMAIL' }), 'gmail');
  assert.equal(getEmailProvider({ EMAIL_PROVIDER: ' smtp ' }), 'smtp');
  assert.equal(getEmailProvider({ EMAIL_PROVIDER: '' }), 'smtp');
  console.log('✓ Test 1: getEmailProvider selects correct provider with smtp fallback');

  // Test 2: Config issues
  // Gmail without password or oauth
  const gmailNoPass = getEmailConfigIssue({
    EMAIL_PROVIDER: 'gmail',
    GMAIL_USER: 'u@example.com',
    EMAIL_FROM: 'from@example.com',
  });
  assert.match(gmailNoPass ?? '', /GMAIL_APP_PASSWORD|OAuth2/);

  // Gmail with OAuth2 credentials is ok
  const gmailOAuthOk = getEmailConfigIssue({
    EMAIL_PROVIDER: 'gmail',
    GMAIL_USER: 'u@example.com',
    EMAIL_FROM: 'from@example.com',
    GMAIL_CLIENT_ID: 'cid',
    GMAIL_CLIENT_SECRET: 'csec',
    GMAIL_REFRESH_TOKEN: 'rtok',
  });
  assert.equal(gmailOAuthOk, null);

  // Gmail with app password is ok
  const gmailAppPassOk = getEmailConfigIssue({
    EMAIL_PROVIDER: 'gmail',
    GMAIL_USER: 'u@example.com',
    EMAIL_FROM: 'from@example.com',
    GMAIL_APP_PASSWORD: 'app-secret-pwd',
  });
  assert.equal(gmailAppPassOk, null);

  // SMTP missing host
  const smtpNoHost = getEmailConfigIssue({
    EMAIL_PROVIDER: 'smtp',
    SMTP_PORT: '587',
    EMAIL_FROM: 'from@example.com',
  });
  assert.match(smtpNoHost ?? '', /SMTP_HOST/);

  // SMTP missing or invalid port
  const smtpNoPort = getEmailConfigIssue({
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    EMAIL_FROM: 'from@example.com',
  });
  assert.match(smtpNoPort ?? '', /SMTP_PORT/);

  const smtpInvalidPort = getEmailConfigIssue({
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 'not-a-port',
    EMAIL_FROM: 'from@example.com',
  });
  assert.match(smtpInvalidPort ?? '', /SMTP_PORT/);

  // SMTP ok
  const smtpOk = getEmailConfigIssue({
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    EMAIL_FROM: 'from@example.com',
  });
  assert.equal(smtpOk, null);
  console.log('✓ Test 2: getEmailConfigIssue detects missing and valid configurations');

  // Test 3: Delivery defaults and overrides
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'production' }), true);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'development' }), false);
  assert.equal(isEmailDeliveryEnabled({}), false);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'production', EMAIL_DELIVERY_ENABLED: 'false' }), false);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'production', EMAIL_DELIVERY_ENABLED: '0' }), false);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'production', EMAIL_DELIVERY_ENABLED: 'no' }), false);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'development', EMAIL_DELIVERY_ENABLED: 'true' }), true);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'development', EMAIL_DELIVERY_ENABLED: '1' }), true);
  assert.equal(isEmailDeliveryEnabled({ NODE_ENV: 'development', EMAIL_DELIVERY_ENABLED: 'yes' }), true);
  console.log('✓ Test 3: isEmailDeliveryEnabled defaults to production true, dev false, with overrides');

  // Test 4: getPublicBaseUrl
  assert.equal(getPublicBaseUrl({}), 'http://localhost:3000');
  assert.equal(getPublicBaseUrl({ NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.equal(getPublicBaseUrl({ PUBLIC_BASE_URL: 'http://localhost:3000/' }), 'http://localhost:3000');
  assert.equal(getPublicBaseUrl({ PUBLIC_BASE_URL: 'https://budget.lnf.gr///' }), 'https://budget.lnf.gr');
  assert.equal(
    getPublicBaseUrl({ NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://budget.lnf.gr' }),
    'https://budget.lnf.gr'
  );
  assert.throws(
    () => getPublicBaseUrl({ NODE_ENV: 'production' }),
    /PUBLIC_BASE_URL must be set in production/
  );
  assert.throws(
    () => getPublicBaseUrl({ NODE_ENV: 'production', PUBLIC_BASE_URL: '' }),
    /PUBLIC_BASE_URL must be set in production/
  );
  assert.throws(
    () => getPublicBaseUrl({ NODE_ENV: 'production', PUBLIC_BASE_URL: '   ' }),
    /PUBLIC_BASE_URL must be set in production/
  );
  console.log('✓ Test 4: getPublicBaseUrl resolves dev default, trims slashes, enforces in production');

  // Test 5: buildTransportOptions shapes
  const gmailPass = buildTransportOptions({
    EMAIL_PROVIDER: 'gmail',
    GMAIL_USER: 'u@example.com',
    GMAIL_APP_PASSWORD: 'app-password',
  });
  assert.deepEqual(gmailPass, {
    service: 'gmail',
    auth: {
      user: 'u@example.com',
      pass: 'app-password',
    },
  });

  const gmailOAuth = buildTransportOptions({
    EMAIL_PROVIDER: 'gmail',
    GMAIL_USER: 'u@example.com',
    GMAIL_CLIENT_ID: 'cid',
    GMAIL_CLIENT_SECRET: 'csec',
    GMAIL_REFRESH_TOKEN: 'rtok',
    GMAIL_ACCESS_TOKEN: 'atok',
  });
  assert.deepEqual(gmailOAuth, {
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: 'u@example.com',
      clientId: 'cid',
      clientSecret: 'csec',
      refreshToken: 'rtok',
      accessToken: 'atok',
    },
  });

  const smtpAuth = buildTransportOptions({
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'smtpuser',
    SMTP_PASS: 'smtppass',
  });
  assert.deepEqual(smtpAuth, {
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    auth: {
      user: 'smtpuser',
      pass: 'smtppass',
    },
  });

  const smtpNoAuth = buildTransportOptions({
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '25',
    SMTP_SECURE: 'false',
  });
  assert.deepEqual(smtpNoAuth, {
    host: 'smtp.example.com',
    port: 25,
    secure: false,
    auth: undefined,
  });
  console.log('✓ Test 5: buildTransportOptions generates correct Gmail and SMTP configs');

  // Test 6: sendEmail with delivery disabled resolves delivered:false
  const prevDelivery = process.env.EMAIL_DELIVERY_ENABLED;
  try {
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    const result = await sendEmail({
      to: 'dev@example.com',
      subject: 'Aura Budget test reset link',
      text: 'Click here to reset your password: http://localhost:3000/reset-password?token=abc',
    });
    assert.equal(result.delivered, false);
    assert.equal(result.messageId, null);
  } finally {
    if (prevDelivery !== undefined) {
      process.env.EMAIL_DELIVERY_ENABLED = prevDelivery;
    } else {
      delete process.env.EMAIL_DELIVERY_ENABLED;
    }
  }
  console.log('✓ Test 6: sendEmail with delivery disabled logs to console and returns delivered:false');

  console.log('\n🎉 All email service tests passed!');
}

run();
