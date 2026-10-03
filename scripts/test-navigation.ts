import assert from 'node:assert/strict';
import {
  isAuthPath,
  isPublicPath,
  isLandingView,
  isSplashView,
  isPublicChromeView,
  safeNextPath,
  authHref,
} from '../src/lib/navigation';

type Mode = 'mock' | 'normal';
const view = (pathname: string, authMode: Mode, isAuthLoading: boolean, hasUser: boolean) => {
  if (isLandingView({ pathname, authMode, isAuthLoading, hasUser })) return 'landing';
  if (isSplashView({ pathname, authMode, isAuthLoading })) return 'splash';
  if (isPublicChromeView({ pathname, authMode, isAuthLoading, hasUser })) return 'public-chrome';
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

  // private and auth paths never landing/splash/public-chrome
  for (const path of ['/expenses', '/login']) {
    for (const loading of [true, false]) {
      for (const user of [true, false]) {
        assert.equal(view(path, 'normal', loading, user), 'app', `${path} ${loading} ${user}`);
      }
    }
  }
  console.log('✓ Test 4: private/auth non-root paths always use standard app chrome');

  // isSplashView for public non-auth paths
  assert.equal(isSplashView({ pathname: '/invite/x', authMode: 'normal', isAuthLoading: true }), true);
  assert.equal(isSplashView({ pathname: '/invite/x', authMode: 'mock', isAuthLoading: true }), false);
  assert.equal(isSplashView({ pathname: '/invite/x', authMode: 'normal', isAuthLoading: false }), false);
  console.log('✓ Test 5: isSplashView covers public non-auth paths while loading in normal mode');

  // isPublicChromeView matrix
  assert.equal(isPublicChromeView({ pathname: '/invite/x', authMode: 'normal', isAuthLoading: false, hasUser: false }), true);
  assert.equal(isPublicChromeView({ pathname: '/invite/x', authMode: 'normal', isAuthLoading: false, hasUser: true }), false);
  assert.equal(isPublicChromeView({ pathname: '/invite/x', authMode: 'normal', isAuthLoading: true, hasUser: false }), false);
  assert.equal(isPublicChromeView({ pathname: '/invite/x', authMode: 'mock', isAuthLoading: false, hasUser: false }), false);
  assert.equal(isPublicChromeView({ pathname: '/login', authMode: 'normal', isAuthLoading: false, hasUser: false }), false);
  assert.equal(isPublicChromeView({ pathname: '/expenses', authMode: 'normal', isAuthLoading: false, hasUser: false }), false);
  assert.equal(isPublicChromeView({ pathname: '/', authMode: 'normal', isAuthLoading: false, hasUser: false }), false);

  // full view resolution for /invite/x
  assert.equal(view('/invite/x', 'normal', true, false), 'splash');
  assert.equal(view('/invite/x', 'normal', true, true), 'splash');
  assert.equal(view('/invite/x', 'normal', false, false), 'public-chrome');
  assert.equal(view('/invite/x', 'normal', false, true), 'app');
  assert.equal(view('/invite/x', 'mock', true, false), 'app');
  assert.equal(view('/invite/x', 'mock', false, false), 'app');
  console.log('✓ Test 6: isPublicChromeView and view resolution on public non-auth paths');

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
  console.log('✓ Test 7: safeNextPath only allows same-origin relative paths');

  const href = new URL(authHref('register', '/invite/X?join=1', { email: 'a@b.c' }), 'http://x');
  assert.equal(href.pathname, '/register');
  assert.equal(href.searchParams.get('next'), '/invite/X?join=1');
  assert.equal(href.searchParams.get('email'), 'a@b.c');
  assert.equal(authHref('login'), '/login');
  assert.equal(authHref('login', 'https://evil.com'), '/login');
  assert.equal(authHref('forgot-password', '/expenses'), '/forgot-password?next=%2Fexpenses');
  console.log('✓ Test 8: authHref keeps a safe next and the email');

  console.log('\n🎉 All navigation tests passed!');
}

run();
