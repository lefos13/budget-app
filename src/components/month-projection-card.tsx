'use client';

import React from 'react';
import { Calculator, Info } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';

export function MonthProjectionCard() {
  const { walletData } = useApp();
  const { t } = useTranslation();

  const projection = walletData?.metrics?.projection;
  if (!walletData || !projection) return null;

  const currency = walletData.wallet.currency;

  const totalCommittedAndSpent = projection.spent + projection.committedTotal;
  const budget = projection.budget;

  let ratio = 0;
  let clampedWidth = 0;
  let barColor = 'bg-emerald-500';
  let percentageLabel = '0%';

  if (budget > 0) {
    ratio = (totalCommittedAndSpent / budget) * 100;
    clampedWidth = Math.min(100, Math.max(0, ratio));
    percentageLabel = `${Math.round(ratio)}%`;
    if (ratio > 100) {
      barColor = 'bg-rose-500';
    } else if (ratio > 85) {
      barColor = 'bg-amber-500';
    } else {
      barColor = 'bg-emerald-500';
    }
  } else {
    if (totalCommittedAndSpent > 0) {
      ratio = 100;
      clampedWidth = 100;
      barColor = 'bg-rose-500';
      percentageLabel = '>100%';
    } else {
      ratio = 0;
      clampedWidth = 0;
      barColor = 'bg-emerald-500';
      percentageLabel = '0%';
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white">
            {t.projection.title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t.projection.subtitle}
          </p>
        </div>
      </div>

      {/* Main Content: Big Result & Breakdown List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pt-5">
        {/* Left Column: Big Result & Progress Bar */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {t.projection.projectedRemaining}
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3
                className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight tabular-nums ${
                  projection.isOverBudget
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(projection.projectedRemaining, currency)}
              </h3>
            </div>
            {projection.isOverBudget && (
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  {t.projection.overBy.replace('{amount}', formatCurrency(projection.overBy, currency))}
                </span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span>{t.projection.totalCommitted}</span>
              <span className="tabular-nums">
                {percentageLabel} ({formatCurrency(totalCommittedAndSpent, currency)})
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${clampedWidth}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown List */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="space-y-1.5">
            {/* Monthly budget */}
            <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {t.projection.budget}
              </span>
              <span className="font-bold tabular-nums text-zinc-900 dark:text-white">
                +{formatCurrency(projection.budget, currency)}
              </span>
            </div>

            {/* Spent so far */}
            <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {t.projection.spentSoFar}
              </span>
              <span className="font-bold tabular-nums text-zinc-900 dark:text-white">
                −{formatCurrency(projection.spent, currency)}
              </span>
            </div>

            {/* Planned expenses (pending) */}
            <div
              className={`flex items-center justify-between text-xs sm:text-sm py-1.5 transition-opacity ${
                projection.plannedPending === 0
                  ? 'opacity-40 text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="font-medium">
                {t.projection.plannedPending}
              </span>
              <span className="font-semibold tabular-nums">
                −{formatCurrency(projection.plannedPending, currency)}
              </span>
            </div>

            {/* Bills due this month */}
            <div
              className={`flex items-center justify-between text-xs sm:text-sm py-1.5 transition-opacity ${
                projection.billsDue === 0
                  ? 'opacity-40 text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="font-medium">
                {t.projection.billsDue}
              </span>
              <span className="font-semibold tabular-nums">
                −{formatCurrency(projection.billsDue, currency)}
              </span>
            </div>

            {/* Subscriptions this month */}
            <div
              className={`flex items-center justify-between text-xs sm:text-sm py-1.5 transition-opacity ${
                projection.subscriptionsDue === 0
                  ? 'opacity-40 text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="font-medium">
                {t.projection.subscriptionsDue}
              </span>
              <span className="font-semibold tabular-nums">
                −{formatCurrency(projection.subscriptionsDue, currency)}
              </span>
            </div>

            {/* Carried over from earlier months (ONLY when carryOver > 0) */}
            {projection.carryOver > 0 && (
              <div className="py-1.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">
                    {t.projection.carriedOver}
                  </span>
                  <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    −{formatCurrency(projection.carryOver, currency)}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                  <span>
                    {projection.carryOverSubscriptions > 0
                      ? t.projection.carriedOverHintSubs
                      : t.projection.carriedOverHint}
                  </span>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 my-2" />

            {/* Result row */}
            <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
              <span className="font-bold text-zinc-900 dark:text-white">
                {t.projection.projectedRemaining}
              </span>
              <span
                className={`font-black text-sm sm:text-base tabular-nums ${
                  projection.isOverBudget
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(projection.projectedRemaining, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
        {t.projection.footnote}
      </div>
    </div>
  );
}
