'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { isMonthScopedPath } from '@/lib/navigation';
import { compareMonthKeys, getCurrentMonthKey } from '@/lib/month';
import { MonthSwitcher } from '@/components/month-switcher';

export function MonthContextBar() {
  const pathname = usePathname();
  const { walletData, selectedMonth } = useApp();
  const { t } = useTranslation();

  if (!pathname || !isMonthScopedPath(pathname) || !walletData) {
    return null;
  }

  const currentMonthKey = getCurrentMonthKey();
  const cmp = compareMonthKeys(selectedMonth, currentMonthKey);

  let statusLabel = t.month.statusCurrent;
  let statusColorClasses =
    'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60';

  if (cmp < 0) {
    statusLabel = t.month.statusPast;
    statusColorClasses =
      'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60';
  } else if (cmp > 0) {
    statusLabel = t.month.statusFuture;
    statusColorClasses =
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60';
  }

  return (
    <div className="sticky z-30 top-[var(--app-header-h)] md:top-0 bg-zinc-50/85 dark:bg-zinc-950/85 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800/70">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4">
        <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0">
          {t.month.viewingMonth}
        </span>
        <MonthSwitcher />
        <span
          role="img"
          title={statusLabel}
          aria-label={statusLabel}
          className={`inline-flex items-center justify-center shrink-0 rounded-full border w-3 h-3 sm:w-auto sm:h-auto sm:px-2.5 sm:py-0.5 text-xs font-bold ${statusColorClasses}`}
        >
          <span className="hidden sm:inline">{statusLabel}</span>
        </span>
      </div>
    </div>
  );
}
