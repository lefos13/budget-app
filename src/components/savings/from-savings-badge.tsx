'use client';

import React from 'react';
import { PiggyBank } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency } from '@/lib/formatters';

/** Shows how much of an expense was paid from a savings bucket (not counted against the month). */
export function FromSavingsBadge({ amount, currency }: { amount: number | undefined; currency: string }) {
  const { t } = useTranslation();
  if (!amount || amount <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 tabular-nums whitespace-nowrap">
      <PiggyBank className="w-3 h-3" />
      {interpolate(t('savings.fromSavingsBadge'), { amount: formatCurrency(amount, currency) })}
    </span>
  );
}
