import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { LandingPage } from '@/components/landing/landing-page';
import { isLandingLanguage, landingJsonLd } from '@/lib/seo';

/* Regenerated daily so the mockups' month and the footer year stay current. */
export const revalidate = 86400;

export default async function LandingRoute({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLandingLanguage(lang)) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd(lang)).replace(/</g, '\\u003c') }}
      />
      <LandingPage today={format(new Date(), 'yyyy-MM-dd')} />
    </>
  );
}
