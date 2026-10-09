import assert from 'node:assert/strict';
import { en } from '../src/lib/i18n/dictionaries/en';
import { el } from '../src/lib/i18n/dictionaries/el';
import { NAV_GROUPS } from '../src/lib/navigation';
import {
  SITE_URL,
  LANDING_LANGUAGES,
  landingPath,
  isLandingLanguage,
  landingMetadata,
  landingJsonLd,
  robotsConfig,
  sitemapEntries,
  PRIVATE_APP_PATHS,
} from '../src/lib/seo';
import { LANDING_SESSION_COOKIE, shouldRewriteRootToLanding } from '../src/lib/landing-routing';
import { SESSION_COOKIE_NAME } from '../src/lib/auth';

/** Reads a nested JSON-LD value without casting the whole graph. */
const get = (value: unknown, ...keys: Array<string | number>): unknown =>
  keys.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], value);

function run() {
  console.log('🧪 Starting SEO test suite...\n');

  assert.equal(SITE_URL, 'https://budget.lnf.gr');
  assert.deepEqual([...LANDING_LANGUAGES], ['el', 'en']);
  assert.equal(landingPath('el'), '/');
  assert.equal(landingPath('en'), '/en');
  assert.equal(isLandingLanguage('el'), true);
  assert.equal(isLandingLanguage('en'), true);
  assert.equal(isLandingLanguage('de'), false);
  assert.equal(isLandingLanguage(undefined), false);
  console.log('✓ Test 1: Greek lives at /, English at /en');

  for (const lang of LANDING_LANGUAGES) {
    const dict = lang === 'el' ? el : en;
    const meta = landingMetadata(lang);
    assert.equal(meta.title, dict.landing.seo.title);
    assert.equal(meta.description, dict.landing.seo.description);
    assert.equal(String(meta.metadataBase), `${SITE_URL}/`);
    assert.equal(meta.alternates?.canonical, landingPath(lang));
    assert.deepEqual(meta.alternates?.languages, { el: '/', en: '/en', 'x-default': '/' });
    assert.deepEqual(meta.robots, { index: true, follow: true });
    const og = meta.openGraph as Record<string, unknown>;
    assert.equal(og.url, landingPath(lang));
    assert.equal(og.locale, lang === 'el' ? 'el_GR' : 'en_US');
    assert.deepEqual(og.alternateLocale, [lang === 'el' ? 'en_US' : 'el_GR']);
    assert.equal(og.siteName, 'Aura Budget');
    assert.equal(og.type, 'website');
    assert.equal((meta.twitter as Record<string, unknown>).card, 'summary_large_image');
    assert.ok(dict.landing.seo.title.length <= 70, `${lang} title too long for SERPs`);
    assert.ok(dict.landing.seo.description.length <= 160, `${lang} description too long for SERPs`);
  }
  console.log('✓ Test 2: landing metadata is localized, canonical and cross-linked with hreflang');

  for (const lang of LANDING_LANGUAGES) {
    const dict = lang === 'el' ? el : en;
    const [app, faq] = landingJsonLd(lang);
    assert.equal(get(app, '@context'), 'https://schema.org');
    assert.equal(get(app, '@type'), 'WebApplication');
    assert.equal(get(app, 'name'), 'Aura Budget');
    assert.equal(get(app, 'url'), `${SITE_URL}${landingPath(lang)}`);
    assert.equal(get(app, 'inLanguage'), lang);
    assert.equal(get(app, 'applicationCategory'), 'FinanceApplication');
    assert.equal(get(app, 'offers', 'price'), '0');
    assert.equal(get(app, 'publisher', '@type'), 'Organization');
    assert.equal(get(app, 'publisher', 'name'), 'LnF');
    assert.equal(get(app, 'publisher', 'url'), 'https://apps.lnf.gr');
    assert.equal(get(faq, '@type'), 'FAQPage');
    assert.equal(get(faq, 'mainEntity', 'length'), 6);
    assert.equal(get(faq, 'mainEntity', 0, 'name'), dict.landing.faq.q1);
    assert.equal(get(faq, 'mainEntity', 0, 'acceptedAnswer', 'text'), dict.landing.faq.a1);
  }
  console.log('✓ Test 3: JSON-LD describes a free WebApplication published by LnF, plus the FAQ');

  const appHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)).filter((h) => h !== '/');
  for (const href of [...appHrefs, '/profile']) {
    assert.ok(PRIVATE_APP_PATHS.includes(href), `${href} must be private`);
  }
  assert.ok(!PRIVATE_APP_PATHS.includes('/'));
  const robots = robotsConfig();
  const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
  assert.equal(rule.userAgent, '*');
  assert.equal(rule.allow, '/');
  const disallow = rule.disallow as string[];
  assert.ok(disallow.includes('/api/'));
  for (const p of PRIVATE_APP_PATHS) assert.ok(disallow.includes(p), `${p} must be disallowed`);
  // Linked or shared pages must stay crawlable so crawlers can read their noindex.
  for (const p of ['/', '/en', '/login', '/register', '/invite/']) {
    assert.ok(!disallow.includes(p), `${p} must not be disallowed`);
  }
  assert.equal(robots.sitemap, `${SITE_URL}/sitemap.xml`);
  console.log('✓ Test 4: robots.txt blocks the private app and the API, keeps public pages crawlable');

  const sitemap = sitemapEntries();
  assert.deepEqual(
    sitemap.map((e) => e.url),
    [`${SITE_URL}/`, `${SITE_URL}/en`]
  );
  for (const entry of sitemap) {
    assert.deepEqual(entry.alternates?.languages, {
      el: `${SITE_URL}/`,
      en: `${SITE_URL}/en`,
      'x-default': `${SITE_URL}/`,
    });
  }
  console.log('✓ Test 5: sitemap lists only the two landing pages with language alternates');

  assert.equal(shouldRewriteRootToLanding({ NODE_ENV: 'production' }), true);
  // Dev can flip to mock mode in localStorage, which the server cannot see: keep `/` the app there.
  assert.equal(shouldRewriteRootToLanding({ NODE_ENV: 'development', NEXT_PUBLIC_AUTH_MODE: 'normal' }), false);
  assert.equal(shouldRewriteRootToLanding({ NODE_ENV: 'development' }), false);
  assert.equal(shouldRewriteRootToLanding({ NODE_ENV: 'development', NEXT_PUBLIC_AUTH_MODE: 'mock' }), false);
  assert.equal(LANDING_SESSION_COOKIE, SESSION_COOKIE_NAME);
  console.log('✓ Test 6: / is server-rewritten to the landing only in production');

  assert.ok(!JSON.stringify(en.landingMock).includes('aura.budget'));
  assert.ok(!JSON.stringify(el.landingMock).includes('aura.budget'));
  console.log('✓ Test 7: mockups show the real domain');

  console.log('\n🎉 All SEO tests passed!');
}

run();
