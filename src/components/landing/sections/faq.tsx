'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

const ITEMS = [1, 2, 3, 4, 5, 6] as const;

export function Faq() {
  const { t } = useTranslation();

  return (
    <section id="faq" aria-labelledby="faq-title" className="py-14 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            {t('landing.faq.eyebrow')}
          </p>
          <h2
            id="faq-title"
            className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white text-balance"
          >
            {t('landing.faq.title')}
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {ITEMS.map((n) => (
            <details
              key={n}
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left font-bold text-zinc-900 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 text-balance">{t(`landing.faq.q${n}`)}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="px-5 pb-5 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
                {t(`landing.faq.a${n}`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
