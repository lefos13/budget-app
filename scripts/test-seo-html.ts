/*
 * Crawler's-eye smoke test of a built server. Needs a production build with real auth:
 *   NEXT_PUBLIC_AUTH_MODE=normal pnpm build && pnpm start -p 3300
 *   SEO_BASE_URL=http://localhost:3300 pnpm test:seo
 */
import assert from 'node:assert/strict';
import { en } from '../src/lib/i18n/dictionaries/en';
import { el } from '../src/lib/i18n/dictionaries/el';

const BASE = process.env.SEO_BASE_URL ?? 'http://localhost:3300';

async function get(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  return { res, body: await res.text() };
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;');
const robotsMeta = (html: string) => html.match(/<meta name="robots" content="([^"]+)"/)?.[1];
const jsonLdTypes = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].flatMap((m) =>
    (JSON.parse(m[1]) as Array<{ '@type': string }>).map((node) => node['@type'])
  );

async function run() {
  console.log(`🧪 Starting SEO HTML smoke test against ${BASE}...\n`);

  for (const [path, lang, dict] of [['/', 'el', el], ['/en', 'en', en]] as const) {
    const { res, body } = await get(path);
    assert.equal(res.status, 200, path);
    assert.ok(body.includes(`<html lang="${lang}"`), `${path} lang`);
    assert.ok(body.includes(`<title>${escapeHtml(dict.landing.seo.title)}</title>`), `${path} title`);
    assert.ok(body.includes(dict.landing.hero.title), `${path} must ship the landing HTML, not a splash`);
    assert.equal(robotsMeta(body), 'index, follow', `${path} robots`);
    assert.ok(body.includes(`<link rel="canonical" href="https://budget.lnf.gr${path === '/' ? '' : path}"/>`), `${path} canonical`);
    for (const alt of ['hrefLang="el"', 'hrefLang="en"', 'hrefLang="x-default"']) {
      assert.ok(body.includes(`<link rel="alternate" ${alt}`), `${path} ${alt}`);
    }
    assert.deepEqual(jsonLdTypes(body), ['WebApplication', 'FAQPage'], `${path} JSON-LD`);
    const ogImage = body.match(/<meta property="og:image" content="https:\/\/budget\.lnf\.gr([^"]+)"/)?.[1];
    assert.ok(ogImage, `${path} og:image`);
    const image = await fetch(`${BASE}${ogImage}`);
    assert.equal(image.headers.get('content-type'), 'image/png', `${path} og:image renders`);
    assert.ok(body.includes('href="https://apps.lnf.gr"'), `${path} links back to the LnF showcase`);
  }
  console.log('✓ Test 1: / (Greek) and /en ship full, indexable, cross-linked landing HTML');

  const signedIn = await get('/', { headers: { cookie: 'aura_session=stale' } });
  assert.equal(robotsMeta(signedIn.body), 'noindex, nofollow');
  assert.ok(!signedIn.body.includes('application/ld+json'));
  console.log('✓ Test 2: with a session cookie / is the (noindex) app');

  const elAlias = await get('/el');
  assert.equal(elAlias.res.status, 308);
  assert.equal(new URL(elAlias.res.headers.get('location')!, BASE).pathname, '/');
  console.log('✓ Test 3: /el permanently redirects to /');

  for (const path of ['/login', '/register', '/forgot-password', '/invite/ABC', '/expenses']) {
    const { body } = await get(path);
    assert.equal(robotsMeta(body), 'noindex, nofollow', path);
  }
  console.log('✓ Test 4: auth pages, invites and app pages are noindex');

  const robots = await get('/robots.txt');
  assert.ok(robots.body.includes('Disallow: /api/'));
  assert.ok(robots.body.includes('Sitemap: https://budget.lnf.gr/sitemap.xml'));
  const sitemap = await get('/sitemap.xml');
  assert.ok(sitemap.body.includes('<loc>https://budget.lnf.gr/</loc>'));
  assert.ok(sitemap.body.includes('<loc>https://budget.lnf.gr/en</loc>'));
  const manifest = JSON.parse((await get('/manifest.webmanifest')).body) as { name: string };
  assert.equal(manifest.name, 'Aura Budget');
  for (const icon of ['/icon/48', '/icon/192', '/icon/512', '/apple-icon']) {
    const res = await fetch(`${BASE}${icon}`);
    assert.equal(res.headers.get('content-type'), 'image/png', icon);
  }
  console.log('✓ Test 5: robots.txt, sitemap, manifest and icons are served');

  console.log('\n🎉 All SEO HTML tests passed!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
