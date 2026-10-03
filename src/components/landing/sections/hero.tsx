'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';

interface HeroProps {
  mockup?: React.ReactNode;
}

export function Hero({ mockup }: HeroProps) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_70%_60%_at_70%_0%,rgba(99,102,241,0.12),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_70%_60%_at_70%_0%,rgba(99,102,241,0.22),rgba(0,0,0,0))]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24 flex flex-col items-center gap-14 sm:gap-16">
        <div className="min-w-0 max-w-3xl text-center flex flex-col items-center">
          <p className="inline-flex items-center rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            {t('landing.hero.eyebrow')}
          </p>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white text-balance leading-[1.05]">
            {t('landing.hero.title')}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl text-pretty">
            {t('landing.hero.subtitle')}
          </p>
          <div className="mt-8 w-full sm:w-auto flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm text-center shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('landing.getStarted')}
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold text-sm text-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('landing.logIn')}
            </Link>
          </div>
          <p className="mt-6 text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-500">
            {t('landing.hero.trust')}
          </p>
        </div>
        {mockup ? <div className="w-full min-w-0">{mockup}</div> : null}
      </div>
    </section>
  );
}
