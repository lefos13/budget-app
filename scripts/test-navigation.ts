import assert from 'node:assert/strict';
import { isAuthPath, isPublicPath, isLandingView, isSplashView, safeNextPath, authHref } from '../src/lib/navigation';

type Mode = 'mock' | 'normal';
const view = (pathname: string, authMode: Mode, isAuthLoading: boolean, hasUser: boolean) => {
  if (isLandingView({ pathname, authMode, isAuthLoading, hasUser })) return 'landing';
  if (isSplashView({ pathname, authMode, isAuthLoading })) return 'splash';
  return 'app';
};

function run() {
  console.log('🧪 Starting navigation gating test suite...\n');

  assert.equal(isAuthPath('/login'), true);
  assert.equal(isAuthPath('/register'), true);
  assert.equal(isAuthPath('/'), false);
  assert.equal(isAuthPath('/invite/x'), false);
  assert.equal(isPublicPath('/invite/x'), true);
  assert.equal(isPublicPath('/login'), true);
  assert.equal(isPublicPath('/expenses'), false);
  assert.equal(isPublicPath('/invitefoo'), false);
  assert.equal(isPublicPath(null), false);
  console.log('✓ Test 1: isAuthPath / isPublicPath');

  // normal mode, `/`
  assert.equal(view('/', 'normal', false, false), 'landing');
  assert.equal(view('/', 'normal', false, true), 'app');
  assert.equal(view('/', 'normal', true, false), 'splash');
  assert.equal(view('/', 'normal', true, true), 'splash');
  console.log('✓ Test 2: normal mode "/" -> landing / app / splash');

  // mock mode never shows landing or splash
  for (const loading of [true, false]) {
    for (const user of [true, false]) {
      assert.equal(view('/', 'mock', loading, user), 'app');
    }
  }
  console.log('✓ Test 3: mock mode "/" is always the app');

  // other paths never landing/splash
  for (const path of ['/expenses', '/login', '/invite/x']) {
    for (const loading of [true, false]) {
      for (const user of [true, false]) {
        assert.equal(view(path, 'normal', loading, user), 'app', `${path} ${loading} ${user}`);
      }
    }
  }
  console.log('✓ Test 4: non-root paths never landing or splash');

  for (const bad of [
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '%2F%2Fevil.com',
    '/%2F%2Fevil.com',
    '/%5Cevil.com',
    '/login',
    '/register?next=/x',
    '/forgot-password',
    '/reset-password?token=x',
    ' /x',
    '',
    null,
    undefined,
  ]) {
    assert.equal(safeNextPath(bad), '/', String(bad));
  }
  for (const good of ['/invite/JOIN-8899?join=1', '/expenses', '/']) {
    assert.equal(safeNextPath(good), good);
  }
  console.log('✓ Test 5: safeNextPath only allows same-origin relative paths');

  const href = new URL(authHref('register', '/invite/X?join=1', { email: 'a@b.c' }), 'http://x');
  assert.equal(href.pathname, '/register');
  assert.equal(href.searchParams.get('next'), '/invite/X?join=1');
  assert.equal(href.searchParams.get('email'), 'a@b.c');
  assert.equal(authHref('login'), '/login');
  assert.equal(authHref('login', 'https://evil.com'), '/login');
  assert.equal(authHref('forgot-password', '/expenses'), '/forgot-password?next=%2Fexpenses');
  console.log('✓ Test 6: authHref keeps a safe next and the email');

  console.log('\n🎉 All navigation tests passed!');
}

run();
