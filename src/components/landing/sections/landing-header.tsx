'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageLinks, useRememberPageLanguage } from '@/components/landing/language-links';
import { landingPath } from '@/lib/seo';

export function LandingHeader() {
  const { t, language } = useTranslation();
  const rememberLanguage = useRememberPageLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <a href={landingPath(language)} className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
            <Wallet className="w-5 h-5" />
          </span>
          <span className="sr-only sm:not-sr-only text-lg font-black tracking-tight text-zinc-900 dark:text-white">
            {t('landing.brandName')}
          </span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageLinks />
          <Link
            href="/login"
            onClick={rememberLanguage}
            className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('landing.logIn')}
          </Link>
          <Link
            href="/register"
            onClick={rememberLanguage}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
          >
            {t('landing.getStarted')}
          </Link>
        </div>
      </div>
    </header>
  );
}
