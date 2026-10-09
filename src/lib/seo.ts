import type { Metadata, MetadataRoute } from 'next';
import { en } from '@/lib/i18n/dictionaries/en';
import { el } from '@/lib/i18n/dictionaries/el';
import type { Language } from '@/lib/i18n/types';
import { NAV_GROUPS } from '@/lib/navigation';

/*
 * Canonical production origin. Deliberately not PUBLIC_BASE_URL: the landing pages are
 * prerendered at build time, where that variable is unset in CI and points at localhost locally.
 */
export const SITE_URL = 'https://budget.lnf.gr';
// i18n-ignore: brand name
export const BRAND_NAME = 'Aura Budget';
// i18n-ignore: publisher brand
const PUBLISHER = { name: 'LnF', url: 'https://apps.lnf.gr' } as const;

/** Greek first: it owns `/` (and `x-default`), English lives at `/en`. See `.scratch/adr/0002`. */
export const LANDING_LANGUAGES = ['el', 'en'] as const satisfies readonly Language[];

const OG_LOCALE: Record<Language, string> = { el: 'el_GR', en: 'en_US' };

export function landingPath(lang: Language): '/' | '/en' {
  return lang === 'el' ? '/' : '/en';
}

export function isLandingLanguage(value: string | undefined): value is Language {
  return value === 'el' || value === 'en';
}

export const landingDictionary = (lang: Language) => (lang === 'el' ? el : en);
const absolute = (path: string) => `${SITE_URL}${path}`;

export function landingMetadata(lang: Language): Metadata {
  const { seo } = landingDictionary(lang).landing;
  const path = landingPath(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: seo.title,
    description: seo.description,
    applicationName: BRAND_NAME,
    alternates: {
      canonical: path,
      languages: { el: landingPath('el'), en: landingPath('en'), 'x-default': landingPath('el') },
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: path,
      siteName: BRAND_NAME,
      title: seo.title,
      description: seo.description,
      locale: OG_LOCALE[lang],
      alternateLocale: LANDING_LANGUAGES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description },
  };
}

const FAQ_ITEMS = [1, 2, 3, 4, 5, 6] as const;

/** schema.org graph for the landing: the app itself (published by LnF) and its FAQ. */
export function landingJsonLd(lang: Language): Record<string, unknown>[] {
  const { landing } = landingDictionary(lang);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: BRAND_NAME,
      url: absolute(landingPath(lang)),
      description: landing.seo.description,
      inLanguage: lang,
      availableLanguage: ['el', 'en'],
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript', // i18n-ignore: schema.org value, not UI
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      publisher: { '@type': 'Organization', name: PUBLISHER.name, url: PUBLISHER.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: FAQ_ITEMS.map((n) => ({
        '@type': 'Question',
        name: landing.faq[`q${n}`],
        acceptedAnswer: { '@type': 'Answer', text: landing.faq[`a${n}`] },
      })),
    },
  ];
}

/** Signed-in app pages. Never linked publicly, so they are blocked outright (and also noindex). */
export const PRIVATE_APP_PATHS: string[] = [
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)).filter((href) => href !== '/'),
  '/profile',
];

/*
 * Auth pages and invites stay crawlable on purpose: they are linked from the landing or shared
 * in messages, and a crawler has to fetch them to see their noindex and drop them.
 */
export function robotsConfig(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', ...PRIVATE_APP_PATHS] },
    sitemap: absolute('/sitemap.xml'),
  };
}

export function sitemapEntries(): MetadataRoute.Sitemap {
  const languages = {
    el: absolute(landingPath('el')),
    en: absolute(landingPath('en')),
    'x-default': absolute(landingPath('el')),
  };
  return LANDING_LANGUAGES.map((lang) => ({
    url: absolute(landingPath(lang)),
    changeFrequency: 'monthly',
    priority: lang === 'el' ? 1 : 0.9,
    alternates: { languages },
  }));
}
