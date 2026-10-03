'use client';

import React from 'react';
import { Coffee } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { GITHUB_SPONSORS_URL, BUY_ME_A_COFFEE_URL } from '@/lib/support-links';

export function GithubMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function SupportLinkButtons({
  variant = 'prominent',
  className,
}: {
  variant?: 'prominent' | 'subtle';
  className?: string;
}) {
  const { t } = useTranslation();

  const isProminent = variant === 'prominent';

  const containerClasses = `flex flex-wrap items-center gap-2.5 sm:gap-3 ${className || ''}`.trim();

  const githubClasses = isProminent
    ? 'px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 shadow-md transition-all active:scale-[0.98]'
    : 'px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors';

  const coffeeClasses = isProminent
    ? 'px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 bg-[#FFDD00] text-zinc-950 hover:bg-[#FACC15] dark:bg-[#FFDD00] dark:text-zinc-950 dark:hover:bg-[#FACC15] shadow-md transition-all active:scale-[0.98]'
    : 'px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors';

  const iconClasses = isProminent ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className={containerClasses}>
      <a
        href={GITHUB_SPONSORS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={githubClasses}
      >
        <GithubMark className={iconClasses} />
        <span>{t('support.githubSponsors')}</span>
        <span className="sr-only"> {t('support.opensInNewTab')}</span>
      </a>
      <a
        href={BUY_ME_A_COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={coffeeClasses}
      >
        <Coffee aria-hidden="true" className={iconClasses} />
        <span>{t('support.buyMeACoffee')}</span>
        <span className="sr-only"> {t('support.opensInNewTab')}</span>
      </a>
    </div>
  );
}
