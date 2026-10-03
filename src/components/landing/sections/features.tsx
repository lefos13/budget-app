'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Reveal } from '@/components/landing/reveal';
import { FeatureSection } from '@/components/landing/sections/feature-section';
import { BudgetMockup } from '@/components/landing/mockups/budget-mockup';
import { CalendarMockup } from '@/components/landing/mockups/calendar-mockup';
import { SavingsMockup } from '@/components/landing/mockups/savings-mockup';
import { WalletTeamMockup } from '@/components/landing/mockups/wallet-team-mockup';

export function Features() {
  const { t } = useTranslation();
  const f = t.landing.features;

  const features = [
    { id: 'pace', copy: f.pace, mockup: <BudgetMockup /> },
    { id: 'bills', copy: f.bills, mockup: <CalendarMockup /> },
    { id: 'savings', copy: f.savings, mockup: <SavingsMockup /> },
    { id: 'team', copy: f.team, mockup: <WalletTeamMockup /> },
  ];

  return (
    <section id="features" aria-labelledby="features-title" className="py-10 sm:py-16">
      <Reveal className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{f.eyebrow}</p>
        <h2
          id="features-title"
          className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white text-balance"
        >
          {f.title}
        </h2>
        <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 text-pretty">{f.subtitle}</p>
      </Reveal>
      {features.map(({ id, copy, mockup }, i) => (
        <Reveal key={id}>
          <FeatureSection
            id={id}
            eyebrow={copy.eyebrow}
            title={copy.title}
            body={copy.body}
            points={[copy.point1, copy.point2, copy.point3]}
            mockup={mockup}
            reverse={i % 2 === 1}
          />
        </Reveal>
      ))}
    </section>
  );
}
