import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RootDocument } from '@/components/root-document';
import { LanguageProvider } from '@/context/LanguageContext';
import { LANDING_LANGUAGES, isLandingLanguage, landingMetadata } from '@/lib/seo';

/*
 * Root layout of the public, indexable landing: prerendered once per language so crawlers and
 * link previews get full HTML. `/el` is only reached through the `/` rewrite in next.config.ts.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_LANGUAGES.map((lang) => ({ lang }));
}

type LangParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const { lang } = await params;
  if (!isLandingLanguage(lang)) notFound();
  return landingMetadata(lang);
}

export default async function LandingLayout({ children, params }: LangParams & { children: React.ReactNode }) {
  const { lang } = await params;
  if (!isLandingLanguage(lang)) notFound();

  return (
    <RootDocument lang={lang}>
      <LanguageProvider pageLanguage={lang}>{children}</LanguageProvider>
    </RootDocument>
  );
}
