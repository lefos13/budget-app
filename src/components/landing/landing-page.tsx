'use client';

import React from 'react';
import { LandingHeader } from '@/components/landing/sections/landing-header';
import { Hero } from '@/components/landing/sections/hero';
import { Features } from '@/components/landing/sections/features';
import { HowItWorks } from '@/components/landing/sections/how-it-works';
import { Faq } from '@/components/landing/sections/faq';
import { Support } from '@/components/landing/sections/support';
import { FinalCta } from '@/components/landing/sections/final-cta';
import { LandingFooter } from '@/components/landing/sections/landing-footer';
import { Reveal } from '@/components/landing/reveal';
import { HeroDashboardMockup } from '@/components/landing/mockups/hero-dashboard-mockup';

export function LandingPage() {
  return (
    <div className="min-h-screen w-full">
      <LandingHeader />
      <main>
        <Hero mockup={<HeroDashboardMockup />} />
        <Features />
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <Faq />
        </Reveal>
        <Reveal>
          <Support />
        </Reveal>
        <Reveal>
          <FinalCta />
        </Reveal>
      </main>
      <LandingFooter />
    </div>
  );
}
