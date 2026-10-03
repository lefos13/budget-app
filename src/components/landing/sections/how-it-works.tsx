'use client';

import React from 'react';
import { Wallet, Target, Users } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

const STEPS = [
  { n: 1, Icon: Wallet },
  { n: 2, Icon: Target },
  { n: 3, Icon: Users },
] as const;

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            {t('landing.how.eyebrow')}
          </p>
          <h2
            id="how-it-works-title"
            className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white text-balance"
          >
            {t('landing.how.title')}
          </h2>
        </div>
        <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-indigo-300 dark:via-indigo-700 to-transparent"
          />
          {STEPS.map(({ n, Icon }) => (
            <li
              key={n}
              className="relative min-w-0 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Icon className="h-6 w-6" />
                </span>
                <span
                  aria-hidden="true"
                  className="text-5xl font-black tracking-tight bg-gradient-to-br from-indigo-600 to-sky-500 bg-clip-text text-transparent"
                >
                  {n}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-black text-zinc-900 dark:text-white">{t(`landing.how.step${n}Title`)}</h3>
              <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                {t(`landing.how.step${n}Body`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
