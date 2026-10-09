'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { LANDING_LANGUAGES, landingPath } from '@/lib/seo';

/** Click handler for links into the app (login/register): continue in the language being read. */
export function useRememberPageLanguage() {
  const { language, setLanguage } = useTranslation();
  return () => setLanguage(language);
}

/*
 * Each landing language has its own URL, so switching is a real link (crawlable, hreflang'd).
 * Plain <a>: `/` and `/en` can sit under different root layouts, which needs a full load anyway.
 * The click also remembers the choice so the app opens in that language after sign-in.
 */
export function LanguageLinks() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <nav
      aria-label={t('landing.languageLabel')}
      className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-0.5"
    >
      {LANDING_LANGUAGES.map((lang) => (
        <a
          key={lang}
          href={landingPath(lang)}
          hrefLang={lang}
          lang={lang}
          onClick={() => setLanguage(lang)}
          aria-current={language === lang ? 'page' : undefined}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
            language === lang
              ? 'bg-indigo-600 text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          {lang === 'en' ? t('landing.langEn') : t('landing.langEl')}
        </a>
      ))}
    </nav>
  );
}
