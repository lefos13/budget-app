'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';
import type { MonthProjection } from '@/lib/month-projection';

function Row({
  label,
  amount,
  sign,
  dimmed = false,
  className = 'text-zinc-700 dark:text-zinc-300',
}: {
  label: string;
  amount: string;
  sign: '+' | '−';
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between text-xs sm:text-sm py-1.5 transition-opacity ${
        dimmed ? 'opacity-40 text-zinc-400 dark:text-zinc-500' : className
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="font-semibold tabular-nums">
        {sign}
        {amount}
      </span>
    </div>
  );
}

/**
 * Line-by-line explanation of the overview card: budget − used = remaining, remaining − still due = free to spend.
 */
export function MonthProjectionBreakdown({ projection, currency }: { projection: MonthProjection; currency: string }) {
  const { t } = useTranslation();
  const fmt = (amount: number) => formatCurrency(amount, currency);
  const strong = 'font-semibold text-zinc-900 dark:text-white';
  const positive = 'text-emerald-700 dark:text-emerald-400';

  return (
    <div className="space-y-0.5">
      {/* Budget for the month */}
      <Row label={t.projection.budget} amount={fmt(projection.budget)} sign="+" className={strong} />
      {projection.boost > 0 && <Row label={t.projection.boost} amount={fmt(projection.boost)} sign="+" className={positive} />}
      {projection.bonus > 0 && <Row label={t.projection.bonus} amount={fmt(projection.bonus)} sign="+" className={positive} />}

      {/* Already used */}
      <Row label={t.projection.spentSoFar} amount={fmt(projection.spent)} sign="−" />
      {projection.savingsDeposited > 0 && (
        <Row label={t.projection.savingsDeposited} amount={fmt(projection.savingsDeposited)} sign="−" />
      )}
      {projection.subscriptionsPaid > 0 && (
        <Row label={t.projection.subscriptionsPaid} amount={fmt(projection.subscriptionsPaid)} sign="−" />
      )}

      <div className="border-t border-zinc-200 dark:border-zinc-800 my-1.5" />
      <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
        <span className="font-bold text-zinc-900 dark:text-white">{t.projection.remaining}</span>
        <span className="font-bold tabular-nums text-zinc-900 dark:text-white">{fmt(projection.remaining)}</span>
      </div>

      {/* Still due this month */}
      {(projection.savingsDue > 0 || projection.savingsDeposited > 0) && (
        <Row
          label={t.projection.savingsDue}
          amount={fmt(projection.savingsDue)}
          sign="−"
          dimmed={projection.savingsDue === 0}
        />
      )}
      <Row
        label={t.projection.plannedPending}
        amount={fmt(projection.plannedPending)}
        sign="−"
        dimmed={projection.plannedPending === 0}
      />
      <Row label={t.projection.billsDue} amount={fmt(projection.billsDue)} sign="−" dimmed={projection.billsDue === 0} />
      <Row
        label={t.projection.subscriptionsDue}
        amount={fmt(projection.subscriptionsDue)}
        sign="−"
        dimmed={projection.subscriptionsDue === 0}
      />

      {/* Carried over from earlier months (ONLY when carryOver > 0) */}
      {projection.carryOver > 0 && (
        <div className="py-1.5 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{t.projection.carriedOver}</span>
            <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              −{fmt(projection.carryOver)}
            </span>
          </div>
          <div className="flex items-start gap-1.5 mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
            <span>
              {projection.carryOverSubscriptions > 0 ? t.projection.carriedOverHintSubs : t.projection.carriedOverHint}
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-200 dark:border-zinc-800 my-1.5" />
      <div className="flex items-center justify-between text-xs sm:text-sm py-1.5">
        <span className="font-bold text-zinc-900 dark:text-white">{t.projection.freeToSpend}</span>
        <span
          className={`font-black text-sm sm:text-base tabular-nums ${
            projection.isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {fmt(projection.projectedRemaining)}
        </span>
      </div>

      <p className="pt-3 text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
        {t.projection.footnote}
      </p>
    </div>
  );
}
