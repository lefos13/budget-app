'use client';

import React from 'react';
import { HeartHandshake, Coffee } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { GithubMark } from '@/components/support/support-link-buttons';
import {
  GITHUB_SPONSORS_URL,
  BUY_ME_A_COFFEE_URL,
  GITHUB_SPONSORS_LABEL,
  BUY_ME_A_COFFEE_LABEL,
} from '@/lib/support-links';

export function Support() {
  const { t } = useTranslation();

  return (
    <section id="support" aria-labelledby="support-title" className="py-14 sm:py-20 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            <HeartHandshake aria-hidden="true" className="w-4 h-4" />
            <span>{t('landing.support.eyebrow')}</span>
          </div>
          <h2
            id="support-title"
            className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white text-balance"
          >
            {t('landing.support.title')}
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-zinc-600 dark:text-zinc-400 text-pretty">
            {t('landing.support.intro')}
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-5">
          {/* GitHub Sponsors Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <span className="w-12 h-12 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center shadow-md">
                <GithubMark className="w-6 h-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-zinc-900 dark:text-white">
                {t('support.githubSponsors')}
              </h3>
              <p className="mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {t('landing.support.githubSubtitle')}
              </p>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                {t('landing.support.githubDescription')}
              </p>
            </div>
            <div className="mt-6">
              <a
                href={GITHUB_SPONSORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all shadow-md active:scale-[0.98]"
              >
                <GithubMark className="w-4 h-4" />
                <span>{t('landing.support.githubCta')}</span>
                <span className="sr-only"> {t('support.opensInNewTab')}</span>
              </a>
              <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {GITHUB_SPONSORS_LABEL}
              </p>
            </div>
          </div>

          {/* Buy Me a Coffee Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <span className="w-12 h-12 rounded-2xl bg-[#FFDD00] text-zinc-950 flex items-center justify-center shadow-md shadow-amber-500/10">
                <Coffee aria-hidden="true" className="w-6 h-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-zinc-900 dark:text-white">
                {t('support.buyMeACoffee')}
              </h3>
              <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                {t('landing.support.coffeeSubtitle')}
              </p>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                {t('landing.support.coffeeDescription')}
              </p>
            </div>
            <div className="mt-6">
              <a
                href={BUY_ME_A_COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-[#FFDD00] text-zinc-950 hover:bg-[#FACC15] dark:bg-[#FFDD00] dark:text-zinc-950 dark:hover:bg-[#FACC15] transition-all shadow-md active:scale-[0.98]"
              >
                <Coffee aria-hidden="true" className="w-4 h-4" />
                <span>{t('landing.support.coffeeCta')}</span>
                <span className="sr-only"> {t('support.opensInNewTab')}</span>
              </a>
              <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {BUY_ME_A_COFFEE_LABEL}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          {t('landing.support.pledge')}
        </p>
      </div>
    </section>
  );
}
