import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrandMark } from '@/lib/og/brand-mark';
import { BRAND_NAME, isLandingLanguage, landingDictionary } from '@/lib/seo';

const size = { width: 1200, height: 630 };
const dictionaryFor = (lang: string) => landingDictionary(isLandingLanguage(lang) ? lang : 'el');

/*
 * The default next/og font has no Greek glyphs, so Inter's Latin + Greek subsets are bundled.
 * Separate family names: Satori ignores weight when falling back within one family.
 */
const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
/* Read once per server process, not per request. */
const fontsLoaded = Promise.all(
  [
    'inter-latin-800-normal.woff',
    'inter-greek-800-normal.woff',
    'inter-latin-500-normal.woff',
    'inter-greek-500-normal.woff',
  ].map((file) => readFile(join(FONT_DIR, file)))
);

export const dynamic = 'force-static';

export async function generateImageMetadata({ params }: { params: Promise<{ lang: string }> | { lang: string } }) {
  const { lang } = await params;
  return [{ id: 'card', alt: dictionaryFor(lang).landing.seo.ogImageAlt, size, contentType: 'image/png' }];
}

/* Share card: brand mark + name, the hero line and eyebrow in the page's language, the domain. */
export default async function OpenGraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { landing } = dictionaryFor(lang);
  const [latin800, greek800, latin500, greek500] = await fontsLoaded;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          fontFamily: 'Inter, "Inter Greek"',
          color: '#18181b',
          backgroundColor: '#fafafa',
          backgroundImage: 'radial-gradient(ellipse 80% 70% at 85% 0%, rgba(99,102,241,0.22), rgba(250,250,250,0))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <BrandMark size={84} radius={22} />
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{BRAND_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: 30, fontWeight: 500, color: '#4f46e5' }}>{landing.hero.eyebrow}</div>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.08, maxWidth: 1000 }}>
            {landing.hero.title}
          </div>
        </div>
        {/* i18n-ignore: domain */}
        <div style={{ fontSize: 28, fontWeight: 500, color: '#71717a' }}>budget.lnf.gr</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: latin800, weight: 800, style: 'normal' }, // i18n-ignore: font family
        { name: 'Inter Greek', data: greek800, weight: 800, style: 'normal' }, // i18n-ignore: font family
        { name: 'Inter', data: latin500, weight: 500, style: 'normal' }, // i18n-ignore: font family
        { name: 'Inter Greek', data: greek500, weight: 500, style: 'normal' }, // i18n-ignore: font family
      ],
    }
  );
}
