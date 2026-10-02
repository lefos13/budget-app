'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, CheckCircle2, CreditCard, Landmark, Layers, Minus, PiggyBank, Plus, Wallet } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { BucketCard } from '@/components/savings/bucket-card';
import { DepositModal } from '@/components/savings/deposit-modal';
import { AdjustGeneralModal } from '@/components/savings/adjust-general-modal';
import { useSavings } from '@/components/savings/use-savings';
import { compareMonthKeys, getCurrentMonthKey, getMonthBounds } from '@/lib/month';
import { useDisposition, type DispositionChoice } from '@/components/savings/disposition-modal';
import { MoveMoneyModal } from '@/components/savings/move-money-modal';

export default function SavingsPage() {
  const { walletData, isLoading, currentUser, refreshWallet, showToast, selectedMonth, goToCurrentMonth, openEditPlannedExpense } = useApp();
  const { t, dateLocale } = useTranslation();
  const { data, staleData, error, reload } = useSavings();
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);
  const [depositTarget, setDepositTarget] = useState<{ id: string; name: string; suggested: number } | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<'IN' | 'OUT' | null>(null);
  const [moveSource, setMoveSource] = useState<{ id: string; name: string; balance: number; mode: 'MOVE' | 'BOOST' } | null>(null);
  const disposition = useDisposition((data ?? staleData)?.buckets ?? []);

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4">
          <PiggyBank className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{t.wallet.noWalletSelected}</h1>
        <p className="text-sm text-zinc-500 mt-2 mb-6">{t.wallet.noWalletDesc}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all"
        >
          <Layers className="w-4 h-4" />
          <span>{t.alerts.goToOverview}</span>
        </Link>
      </div>
    );
  }

  const currency = walletData.wallet.currency || 'EUR';
  const canEdit = walletData.userRole !== 'VIEWER';
  const canDeposit = compareMonthKeys(selectedMonth, getCurrentMonthKey()) <= 0;
  const view = data ?? staleData;

  const handleUnlink = async (expense: { id: string; title: string }, choice?: DispositionChoice): Promise<boolean> => {
    setBusyExpenseId(expense.id);
    try {
      const res = await fetch(`/api/planned-expenses/${expense.id}/savings`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: choice ? JSON.stringify({ disposition: choice }) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(interpolate(t('savings.unlinkedToast'), { title: expense.title }));
        await refreshWallet();
        return true;
      }
      if (res.status === 409 && json?.error === 'Disposition required' && !choice) {
        disposition.ask(json.bucketId, json.leftover, (c) => handleUnlink(expense, c));
      } else {
        showToast(translateApiError(json?.error, res.status, t));
      }
      return false;
    } catch {
      showToast(t('savings.errorGeneric'));
      return false;
    } finally {
      setBusyExpenseId(null);
    }
  };

  // Where money can move from a bucket: General + every other active bucket.
  const moveDestinations = (fromId: string) => [
    ...(view?.general && view.general.id !== fromId ? [{ id: view.general.id, name: t('savings.generalTitle') }] : []),
    ...(view?.buckets ?? []).filter((b) => b.id !== fromId).map((b) => ({ id: b.id, name: b.name })),
  ];

  const handleRename = async (bucketId: string, name: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/savings/${bucketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(translateApiError(json?.error, res.status, t));
        return false;
      }
      showToast(interpolate(t('savings.renamedToast'), { name }));
      // Wallet data carries the bucket name for the "Saving in …" chips on /expenses.
      await refreshWallet();
      return true;
    } catch {
      showToast(t('savings.errorGeneric'));
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs shrink-0 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{t('savings.pageTitle')}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{t('savings.pageSubtitle')}</p>
          </div>
        </div>
      </div>

      {!canEdit && (
        <p className="text-xs font-medium text-zinc-500 px-1">{t('savings.viewerHint')}</p>
      )}
      {canEdit && !canDeposit && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            {interpolate(t('savings.futureMonthCardHint'), {
              date: formatDate(getMonthBounds(selectedMonth).start, 'd MMMM yyyy', dateLocale),
            })}
          </p>
          <button
            type="button"
            onClick={goToCurrentMonth}
            className="self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
          >
            {t('savings.goToCurrentMonth')}
          </button>
        </div>
      )}

      {error && !view ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {translateApiError(error, undefined, t)}
        </p>
      ) : !view ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm font-medium text-zinc-500">{t('savings.loading')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('savings.totalSaved')}</p>
              <p className="text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
                {formatCurrency(view.totals.saved, currency)}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('savings.dueThisMonth')}</p>
              <p
                className={`text-xl font-black mt-1 tabular-nums ${
                  view.totals.savingsDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(view.totals.savingsDue, currency)}
              </p>
            </div>
            {view.general && (
              <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20 shadow-sm">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    {t('savings.generalTitle')}
                  </p>
                </div>
                <p className="text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
                  {formatCurrency(view.general.balance, currency)}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{t('savings.generalSubtitle')}</p>
                {view.general.depositedThisMonth > 0 && (
                  <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mt-1 tabular-nums">
                    {`${t('savings.depositedThisMonth')}: ${formatCurrency(view.general.depositedThisMonth, currency)}`}
                  </p>
                )}
                {view.general.boostThisMonth > 0 && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                    {`${t('savings.boostedThisMonth')}: ${formatCurrency(view.general.boostThisMonth, currency)}`}
                  </p>
                )}
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {canDeposit && (
                      <button
                        type="button"
                        onClick={() =>
                          view.general &&
                          setDepositTarget({ id: view.general.id, name: t('savings.generalTitle'), suggested: 0 })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <PiggyBank className="w-3.5 h-3.5" />
                        <span>{t('savings.saveFromBudget')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAdjustDirection('IN')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('savings.addMoney')}</span>
                    </button>
                    <button
                      type="button"
                      disabled={view.general.balance <= 0}
                      onClick={() => setAdjustDirection('OUT')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>{t('savings.removeMoney')}</span>
                    </button>
                    {view.buckets.length > 0 && (
                      <button
                        type="button"
                        disabled={view.general.balance <= 0}
                        onClick={() =>
                          view.general &&
                          setMoveSource({ id: view.general.id, name: t('savings.generalTitle'), balance: view.general.balance, mode: 'MOVE' })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>{t('savings.move')}</span>
                      </button>
                    )}
                    {canDeposit && (
                      <button
                        type="button"
                        disabled={view.general.balance <= 0}
                        onClick={() =>
                          view.general &&
                          setMoveSource({ id: view.general.id, name: t('savings.generalTitle'), balance: view.general.balance, mode: 'BOOST' })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{t('savings.useAsBudget')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {view.buckets.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-b from-emerald-50/80 via-white to-white dark:from-emerald-950/20 dark:via-zinc-900/90 dark:to-zinc-900 shadow-sm text-center">
              <div className="w-14 h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <PiggyBank className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">{t('savings.emptyTitle')}</h2>
              <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">{t('savings.emptyText')}</p>
              <Link
                href="/expenses"
                className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t('savings.goToExpenses')}</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {view.buckets.map((bucket) => (
                <BucketCard
                  key={bucket.id}
                  bucket={bucket}
                  currency={currency}
                  canEdit={canEdit}
                  canDeposit={canDeposit}
                  busyExpenseId={busyExpenseId}
                  onUnlink={handleUnlink}
                  onEditExpense={(expense) => {
                    const pe = walletData.plannedExpenses.find((p) => p.id === expense.id) ?? {
                      id: expense.id,
                      walletId: walletData.wallet.id,
                      userId: currentUser?.id || '',
                      categoryId: expense.categoryId,
                      title: expense.title,
                      amount: expense.amount,
                      expectedDate: expense.expectedDate,
                      trackFromMonth: expense.trackFromMonth,
                      notes: null,
                      status: 'PENDING',
                      realizedExpenseId: null,
                      savingsBucketId: bucket.id,
                      savingsBucket: { id: bucket.id, name: bucket.name, color: bucket.color, status: bucket.status },
                      category: walletData.categories.find((c) => c.id === expense.categoryId) || null,
                    };
                    openEditPlannedExpense(pe);
                  }}
                  onDeposit={() => setDepositTarget({ id: bucket.id, name: bucket.name, suggested: bucket.savingsDue })}
                  onMove={() => setMoveSource({ id: bucket.id, name: bucket.name, balance: bucket.balance, mode: 'MOVE' })}
                  onRename={(name) => handleRename(bucket.id, name)}
                />
              ))}
            </div>
          )}

          {view.closedBuckets.length > 0 && (
            <details className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm">
              <summary className="px-5 py-4 cursor-pointer flex items-center justify-between text-sm font-bold text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('savings.completedTitle')}
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  {interpolate(t('savings.completedCount'), { count: view.closedBuckets.length })}
                </span>
              </summary>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border-t border-zinc-100 dark:border-zinc-800">
                {view.closedBuckets.map((b) => (
                  <li key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{b.name}</span>
                    </span>
                    {b.closedAt && (
                      <span className="text-xs text-zinc-500 shrink-0">
                        {interpolate(t('savings.closedOn'), { date: formatDate(b.closedAt, 'MMM d, yyyy', dateLocale) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {depositTarget && (
        <DepositModal
          bucket={depositTarget}
          suggestedAmount={depositTarget.suggested}
          onClose={() => setDepositTarget(null)}
          onDone={refreshWallet}
        />
      )}

      {adjustDirection && view?.general && (
        <AdjustGeneralModal
          generalId={view.general.id}
          direction={adjustDirection}
          balance={view.general.balance}
          onClose={() => setAdjustDirection(null)}
          onDone={reload}
        />
      )}

      {moveSource && (
        <MoveMoneyModal
          mode={moveSource.mode}
          from={moveSource}
          destinations={moveDestinations(moveSource.id)}
          onClose={() => setMoveSource(null)}
          onDone={refreshWallet}
        />
      )}

      {disposition.element}
    </div>
  );
}
