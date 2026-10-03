'use client';

import React from 'react';
import { Wallet, HeartHandshake } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';

export function LandingFooter() {
  const { t, language, setLanguage } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200/70 dark:border-zinc-800/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/25">
            <Wallet className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-zinc-900 dark:text-white">{t('landing.brandName')}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('landing.footer.tagline')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href="#support"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <HeartHandshake aria-hidden="true" className="w-3.5 h-3.5" />
            <span>{t('landing.footer.supportLink')}</span>
          </a>
          <div
            role="group"
            aria-label={t('landing.languageLabel')}
            className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-0.5"
          >
            {(['en', 'el'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  language === lang
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {lang === 'en' ? t('landing.langEn') : t('landing.langEl')}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {interpolate(t('landing.footer.copyright'), { year })}
          </p>
        </div>
      </div>
    </footer>
  );
}
