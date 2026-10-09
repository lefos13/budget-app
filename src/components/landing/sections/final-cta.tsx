'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { useRememberPageLanguage } from '@/components/landing/language-links';

export function FinalCta() {
  const { t } = useTranslation();
  const rememberLanguage = useRememberPageLanguage();

  return (
    <section aria-labelledby="final-cta-title" className="py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-indigo-600 to-sky-500 dark:from-indigo-700 dark:to-sky-700 px-6 py-14 sm:px-12 sm:py-20 text-center shadow-xl shadow-indigo-600/20">
          <h2
            id="final-cta-title"
            className="mx-auto max-w-2xl text-3xl sm:text-4xl font-black tracking-tight text-white text-balance"
          >
            {t('landing.cta.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-white/90 text-pretty">
            {t('landing.cta.subtitle')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/register"
            onClick={rememberLanguage}
              className="px-6 py-3.5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-sm text-center shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('landing.getStarted')}
            </Link>
            <Link
              href="/login"
            onClick={rememberLanguage}
              className="px-6 py-3.5 rounded-2xl border border-white/60 text-white hover:bg-white/15 font-bold text-sm text-center transition-colors"
            >
              {t('landing.logIn')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
