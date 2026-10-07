'use client';

import React, { useState } from 'react';
import { TrendingUp, ShieldCheck, DollarSign, Calendar, Users, Gift, Trash2, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, calculateBudgetPacing } from '@/lib/formatters';
import { effectiveBudget as calcEffectiveBudget } from '@/lib/month-bonus';
import { translateApiError } from '@/lib/i18n/api-errors';
import { getPacingReferenceDate } from '@/lib/month';
import { AddBonusModal } from '@/components/modals/add-bonus-modal';
import { MonthProjectionBreakdown } from '@/components/month-projection-breakdown';

// Hatched fill for money still due: committed but not used yet
const STILL_DUE_FILL =
  'repeating-linear-gradient(135deg, rgb(245 158 11 / 0.6) 0 4px, rgb(245 158 11 / 0.25) 4px 8px)';

export function BudgetOverviewCard() {
  const { walletData, selectedMonth, activeWalletId, currentUser, refreshWallet, showToast } = useApp();
  const { t } = useTranslation();
  const [isBonusOpen, setIsBonusOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  if (!walletData) return null;

  const { monthlyBudget, totalSpentMonth, projection } = walletData.metrics;
  const savings = walletData.metrics.savings ?? { deposited: 0, savingsDue: 0, boost: 0 };
  const currency = walletData.wallet.currency;

  // Money moved into savings is used budget; General savings used as extra budget and month bonuses raise the target.
  const bonus = walletData.metrics.bonus ?? 0;
  const bonuses = walletData.bonuses ?? [];
  const isOwner = walletData.userRole === 'OWNER';
  const effectiveBudget = calcEffectiveBudget({ monthlyBudget, boost: savings.boost, bonus });
  // One source of truth (the month projection): budget − used = remaining; remaining − still due = free to spend
  const usedThisMonth = projection.used;
  const stillDue = projection.committedTotal;
  const freeToSpend = projection.projectedRemaining;
  const pacing = calculateBudgetPacing(
    effectiveBudget,
    usedThisMonth,
    getPacingReferenceDate(selectedMonth),
    stillDue
  );
  const percentLeft = Math.max(0, 100 - pacing.percentageSpent);

  // Bar segments (% of the month budget): spent incl. paid subscriptions, saved, still due
  const toPercent = (amount: number) => (effectiveBudget > 0 ? (amount / effectiveBudget) * 100 : 0);
  const spentWidth = Math.min(100, toPercent(totalSpentMonth + projection.subscriptionsPaid));
  const savedWidth = Math.min(100 - spentWidth, toPercent(savings.deposited));
  const stillDueWidth = Math.min(100 - spentWidth - savedWidth, toPercent(stillDue));
  const filledWidth = spentWidth + savedWidth + stillDueWidth;
  const segmentShare = (width: number) => (filledWidth > 0 ? (width / filledWidth) * 100 : 0);

  const handleRemoveBonus = async (bonusId: string) => {
    if (!activeWalletId) return;
    setRemovingId(bonusId);
    try {
      const res = await fetch(`/api/wallets/${activeWalletId}/bonuses/${bonusId}`, {
        method: 'DELETE',
        headers: currentUser ? { 'x-user-id': currentUser.id } : {},
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(translateApiError(json?.error, res.status, t));
        return;
      }
      showToast(t('bonus.removedToast'));
      await refreshWallet();
    } catch {
      showToast(t('bonus.errorGeneric'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-7 shadow-sm">
      {/* Top Banner: Main Pacing Gauge & Daily Spend Allowance */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.budget.monthlyStatus}
            </span>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                pacing.isOverPace
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
              }`}
            >
              {t.pacing[pacing.statusKey]}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white tabular-nums">
              {formatCurrency(usedThisMonth, currency)}
            </h2>
            <span className="text-sm font-semibold text-zinc-500 tabular-nums">
              {interpolate(t('budget.spentOfTarget'), { target: formatCurrency(effectiveBudget, currency) })}
            </span>
          </div>
          {(savings.deposited > 0 || projection.subscriptionsPaid > 0 || savings.boost > 0 || bonus > 0) && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {[
                savings.deposited > 0
                  ? interpolate(t('budget.inclSaved'), { amount: formatCurrency(savings.deposited, currency) })
                  : null,
                projection.subscriptionsPaid > 0
                  ? interpolate(t('budget.inclSubscriptions'), {
                      amount: formatCurrency(projection.subscriptionsPaid, currency),
                    })
                  : null,
                savings.boost > 0
                  ? interpolate(t('budget.extraFromGeneral'), { amount: formatCurrency(savings.boost, currency) })
                  : null,
                bonus > 0
                  ? interpolate(t('budget.inclBonus'), { amount: formatCurrency(bonus, currency) })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {(isOwner || bonuses.length > 0) && (
            <div className="pt-1 space-y-1.5">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsBonusOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 cursor-pointer transition-colors"
                >
                  <Gift className="w-3.5 h-3.5" />
                  {t('bonus.addButton')}
                </button>
              )}
              {bonuses.length > 0 && (
                <ul aria-label={t('bonus.listTitle')} className="space-y-1">
                  {bonuses.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(b.amount, currency)}
                      </span>
                      <span className="truncate">
                        {[b.label, interpolate(t('bonus.by'), { name: b.user.name })].filter(Boolean).join(' · ')}
                      </span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBonus(b.id)}
                          disabled={removingId === b.id}
                          aria-label={t('bonus.remove')}
                          title={t('bonus.remove')}
                          className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          </div>

        {/* Daily Pacing Badge */}
        <div className="flex items-center gap-3.5 bg-zinc-50 dark:bg-zinc-800/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 self-start lg:self-auto shrink-0 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.budget.dailyFreeToSpend}
            </p>
            <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
              {formatCurrency(pacing.dailyBudgetRemaining, currency)}
              <span className="text-xs font-medium text-zinc-400"> {t.budget.perDay}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar with Today's Milestone Marker */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-semibold mb-2 text-zinc-600 dark:text-zinc-400">
          <span className="font-bold text-zinc-900 dark:text-white">
            {interpolate(t('budget.percentBudgetSpent'), { percent: pacing.percentageSpent })}
          </span>
          <span className="text-zinc-400">
            {t.budget.dayOfMonthTarget} <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{pacing.expectedPercentage}%</strong>
          </span>
        </div>

        <div className="relative w-full h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          {/* Target Month Pace Marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-zinc-900 dark:bg-white z-10 shadow-sm ring-1 ring-zinc-300 dark:ring-zinc-600"
            style={{ left: `${Math.min(100, pacing.expectedPercentage)}%` }}
            title={interpolate(t('budget.paceExpectedToday'), { percent: pacing.expectedPercentage })}
          />
          {/* Spent (incl. paid subscriptions) + saved this month + still due */}
          <div
            className="flex h-full rounded-full overflow-hidden transition-all duration-700"
            style={{ width: `${filledWidth}%` }}
          >
            <div
              className={`h-full transition-all duration-700 ${
                pacing.percentageSpent > 100
                  ? 'bg-rose-500'
                  : pacing.isOverPace
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${segmentShare(spentWidth)}%` }}
            />
            {savedWidth > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${segmentShare(savedWidth)}%` }}
              />
            )}
            {stillDueWidth > 0 && (
              <div
                className="h-full transition-all duration-700"
                style={{ width: `${segmentShare(stillDueWidth)}%`, backgroundImage: STILL_DUE_FILL }}
              />
            )}
          </div>
        </div>

        {/* Bar legend */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                pacing.percentageSpent > 100 ? 'bg-rose-500' : pacing.isOverPace ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
            />
            {t.budget.legendSpent}
          </span>
          {savedWidth > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              {t.budget.legendSaved}
            </span>
          )}
          {stillDue > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundImage: STILL_DUE_FILL }} />
              {t.budget.stillDue}
            </span>
          )}
        </div>
      </div>

      {/* 4 Financial Health Grid Cards: remaining → still due → free to spend */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Remaining after what is already used */}
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.budget.remainingBudget}
            </p>
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1.5 tabular-nums">
            {formatCurrency(projection.remaining, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {interpolate(t('budget.percentLeft'), { percent: percentLeft })}
          </p>
        </div>

        {/* Card 2: Still due this month (bills, subscriptions, planned expenses, savings contributions) */}
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              {t.budget.stillDue}
            </p>
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
            {formatCurrency(stillDue, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{t.budget.stillDueHint}</p>
        </div>

        {/* Card 3: Free to spend once everything still due is paid */}
        <div
          className={`p-4 rounded-2xl border ${
            projection.isOverBudget
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'
              : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p
              className={`text-[11px] font-bold uppercase tracking-wider ${
                projection.isOverBudget ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {t.budget.freeToSpend}
            </p>
            <ShieldCheck
              className={`w-3.5 h-3.5 ${
                projection.isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
          </div>
          <p
            className={`text-lg sm:text-xl font-black mt-1.5 tabular-nums ${
              projection.isOverBudget ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {formatCurrency(freeToSpend, currency)}
          </p>
          <p
            className={`text-[11px] mt-0.5 ${
              projection.isOverBudget
                ? 'text-rose-600/80 dark:text-rose-400/80'
                : 'text-emerald-600/80 dark:text-emerald-400/80'
            }`}
          >
            {projection.isOverBudget
              ? interpolate(t('projection.overBy'), { amount: formatCurrency(projection.overBy, currency) })
              : t.budget.afterEverythingDue}
          </p>
        </div>

        {/* Card 4: Collaborators Active */}
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.budget.collaborators}
            </p>
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5 tabular-nums">
            {(walletData.wallet.members?.length || 1) === 1
              ? t.budget.membersCountOne
              : interpolate(t('budget.membersCountMany'), { count: walletData.wallet.members?.length || 1 })}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {walletData.wallet.members?.slice(0, 3).map((m, idx) => (
              <span key={idx} className="text-[10px] text-zinc-500 truncate">
                {m.user?.name.split(' ')[0]}
                {idx < Math.min(2, (walletData.wallet.members?.length || 1) - 1) ? ',' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* How free to spend is calculated */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsBreakdownOpen((open) => !open)}
          aria-expanded={isBreakdownOpen}
          aria-controls="budget-breakdown"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isBreakdownOpen ? 'rotate-180' : ''}`} />
          {isBreakdownOpen ? t.budget.hideBreakdown : t.budget.showBreakdown}
        </button>
        {isBreakdownOpen && (
          <div
            id="budget-breakdown"
            className="mt-3 max-w-xl p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800"
          >
            <MonthProjectionBreakdown projection={projection} currency={currency} />
          </div>
        )}
      </div>
      {isBonusOpen && <AddBonusModal onClose={() => setIsBonusOpen(false)} />}
    </div>
  );
}
