'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { authHref } from '@/lib/navigation';

function SignInLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const query = searchParams?.toString();
  const currentPathWithSearch = query ? `${pathname}?${query}` : pathname || '/';

  return (
    <Link
      href={authHref('login', currentPathWithSearch)}
      className="inline-flex items-center justify-center min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 transition-colors"
    >
      {t('publicHeader.signIn')}
    </Link>
  );
}

function SignInFallback() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <Link
      href={authHref('login', pathname || '/')}
      className="inline-flex items-center justify-center min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 transition-colors"
    >
      {t('publicHeader.signIn')}
    </Link>
  );
}

export function PublicHeader() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={t('publicHeader.homeLabel')}
          className="inline-flex items-center gap-2.5 min-h-[44px] rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
            {t('brand.name')}
          </span>
        </Link>

        <nav
          aria-label={t('publicHeader.navLabel')}
          className="flex items-center gap-2 sm:gap-3"
        >
          <div
            role="group"
            aria-label={t('publicHeader.languageLabel')}
            className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-0.5"
          >
            {(['en', 'el'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
                className={`min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-0 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  language === lang
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {lang === 'en' ? t('publicHeader.langEn') : t('publicHeader.langEl')}
              </button>
            ))}
          </div>

          <Suspense fallback={<SignInFallback />}>
            <SignInLink />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
