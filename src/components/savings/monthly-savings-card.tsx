'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, PiggyBank, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { compareMonthKeys, getCurrentMonthKey, getMonthBounds } from '@/lib/month';
import { round2 } from '@/lib/savings';
import { DepositModal } from './deposit-modal';
import { useSavings } from './use-savings';

/**
 * "Savings this month": each active bucket's monthly contribution as a monthly item, with a Save action.
 * Shown on the Overview and Expenses pages; hidden when the wallet has no active buckets.
 */
export function MonthlySavingsCard() {
  const { walletData, selectedMonth, refreshWallet, goToCurrentMonth } = useApp();
  const { t, dateLocale } = useTranslation();
  const { data, staleData } = useSavings();
  const [depositTarget, setDepositTarget] = useState<{ id: string; name: string; suggested: number } | null>(null);

  const view = data ?? staleData;
  if (!walletData || !view) return null;
  const rows = view.buckets.filter((b) => b.contributionDue > 0 || b.deposited > 0);
  if (rows.length === 0) return null;

  const currency = walletData.wallet.currency;
  const canEdit = walletData.userRole !== 'VIEWER';
  const isFuture = compareMonthKeys(selectedMonth, getCurrentMonthKey()) > 0;
  const totalDue = round2(rows.reduce((s, b) => s + b.savingsDue, 0));

  return (
    <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">{t('savings.monthlyCardTitle')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {totalDue > 0
                ? interpolate(t(isFuture ? 'savings.monthlyCardPlanned' : 'savings.monthlyCardDue'), {
                    amount: formatCurrency(totalDue, currency),
                  })
                : t('savings.monthlyCardAllSaved')}
            </p>
          </div>
        </div>
        <Link
          href="/savings"
          className="self-start sm:self-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          {t('savings.openSavings')}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isFuture && totalDue > 0 && (
        <div className="px-5 sm:px-6 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {interpolate(t('savings.futureMonthCardHint'), {
              date: formatDate(getMonthBounds(selectedMonth).start, 'd MMMM yyyy', dateLocale),
            })}
          </p>
          <button
            type="button"
            onClick={goToCurrentMonth}
            className="self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
          >
            {t('savings.goToCurrentMonth')}
          </button>
        </div>
      )}

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {rows.map((b) => (
          <li key={b.id} className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{b.name}</p>
                <p className="text-xs text-zinc-500 tabular-nums">
                  {interpolate(t('savings.contributionPerMonth'), { amount: formatCurrency(b.contributionDue, currency) })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {b.savingsDue > 0 ? (
                <>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border tabular-nums ${
                      isFuture
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                    }`}
                  >
                    {interpolate(t(isFuture ? 'savings.plannedAmount' : 'savings.dueAmount'), {
                      amount: formatCurrency(b.savingsDue, currency),
                    })}
                  </span>
                  {canEdit && !isFuture && (
                    <button
                      type="button"
                      onClick={() => setDepositTarget({ id: b.id, name: b.name, suggested: b.savingsDue })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('savings.deposit')}</span>
                    </button>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 tabular-nums">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {interpolate(t('savings.savedAmount'), { amount: formatCurrency(b.contributed, currency) })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {depositTarget && (
        <DepositModal
          bucket={depositTarget}
          suggestedAmount={depositTarget.suggested}
          onClose={() => setDepositTarget(null)}
          onDone={refreshWallet}
        />
      )}
    </section>
  );
}
