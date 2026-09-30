'use client';

import React, { useState } from 'react';
import { ArrowRightLeft, CalendarClock, Check, Pencil, PiggyBank, Plus, Unlink, X } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { SavingsBucketView, SavingsExpense } from './use-savings';

interface BucketCardProps {
  bucket: SavingsBucketView;
  currency: string;
  canEdit: boolean;
  /** False when viewing a future month (deposits only in the current or a past month). */
  canDeposit: boolean;
  busyExpenseId: string | null;
  onUnlink: (expense: { id: string; title: string }) => void;
  onEditExpense?: (expense: SavingsExpense) => void;
  onDeposit: () => void;
  onMove: () => void;
  /** Resolves true when the rename was saved. */
  onRename: (name: string) => Promise<boolean>;
}

export function BucketCard({
  bucket,
  currency,
  canEdit,
  canDeposit,
  busyExpenseId,
  onUnlink,
  onEditExpense,
  onMove,
  onDeposit,
  onRename,
}: BucketCardProps) {
  const { t, dateLocale } = useTranslation();
  const percent = Math.round(bucket.progress * 100);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);

  const saveName = async () => {
    if (draftName === null) return;
    const trimmed = draftName.trim();
    if (!trimmed || trimmed.length > 60) return;
    if (trimmed === bucket.name) {
      setDraftName(null);
      return;
    }
    setIsSavingName(true);
    const ok = await onRename(trimmed);
    setIsSavingName(false);
    if (ok) setDraftName(null);
  };

  return (
    <article className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{ backgroundColor: `${bucket.color}1a`, color: bucket.color, borderColor: `${bucket.color}40` }}
            >
              <PiggyBank className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              {draftName === null ? (
                <div className="flex items-center gap-1 min-w-0">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">{bucket.name}</h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setDraftName(bucket.name)}
                      aria-label={t('savings.rename')}
                      title={t('savings.rename')}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveName();
                  }}
                >
                  <input
                    type="text"
                    value={draftName}
                    maxLength={60}
                    autoFocus
                    disabled={isSavingName}
                    aria-label={t('savings.newBucketName')}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setDraftName(null);
                    }}
                    className="min-w-0 w-40 sm:w-52 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName || !draftName.trim()}
                    aria-label={t('common.save')}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isSavingName}
                    onClick={() => setDraftName(null)}
                    aria-label={t('common.cancel')}
                    className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
              )}
              {bucket.nextDueDate && (
                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                  <CalendarClock className="w-3 h-3" />
                  {interpolate(t('savings.nextDue'), {
                    date: formatDate(bucket.nextDueDate, 'MMM yyyy', dateLocale),
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
              {formatCurrency(bucket.balance, currency)}
            </p>
            <p className="text-[11px] text-zinc-500 tabular-nums">
              {interpolate(t('savings.savedOfTarget'), {
                saved: `${percent}%`,
                target: formatCurrency(bucket.target, currency),
              })}
            </p>
          </div>
        </div>

        <div
          className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={t('savings.saved')}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: bucket.color }} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('savings.dueThisMonth')}</p>
            <p
              className={`text-sm font-black tabular-nums mt-0.5 ${
                bucket.savingsDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatCurrency(bucket.savingsDue, currency)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('savings.monthlyContribution')}</p>
            <p className="text-sm font-black text-zinc-900 dark:text-white tabular-nums mt-0.5">
              {formatCurrency(bucket.contributionDue, currency)}
            </p>
          </div>
        </div>

        {canEdit && (canDeposit || bucket.balance > 0) && (
          <div className="flex gap-2">
            {canDeposit && (
              <button
                type="button"
                onClick={onDeposit}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {bucket.savingsDue > 0
                    ? `${t('savings.deposit')} ${formatCurrency(bucket.savingsDue, currency)}`
                    : t('savings.deposit')}
                </span>
              </button>
            )}
            {bucket.balance > 0 && (
              <button
                type="button"
                onClick={onMove}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{t('savings.move')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800">
        <p className="px-5 pt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('savings.expensesInBucket')}</p>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {bucket.expenses.map((e) => (
            <li key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{e.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formatDate(e.expectedDate, 'MMM d, yyyy', dateLocale)}
                  {' · '}
                  {e.isTrackingActive === false && e.trackFromMonth
                    ? interpolate(t('savings.startsIn'), {
                        month: formatDate(new Date(`${e.trackFromMonth}-01T12:00:00`), 'MMM yyyy', dateLocale),
                      })
                    : e.monthsLeft >= 1
                      ? `${interpolate(t('savings.contributionPerMonth'), {
                          amount: formatCurrency(e.contribution, currency),
                        })} · ${
                          e.monthsLeft === 1
                            ? t('savings.monthsLeftOne')
                            : interpolate(t('savings.monthsLeft'), { count: e.monthsLeft })
                        }`
                      : t('savings.dueNow')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                  {formatCurrency(e.allocated, currency)} / {formatCurrency(e.amount, currency)}
                </span>
                {canEdit && (
                  <>
                    {onEditExpense && (
                      <button
                        type="button"
                        onClick={() => onEditExpense(e)}
                        aria-label={t('savings.editExpense')}
                        title={t('savings.editExpense')}
                        className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyExpenseId === e.id}
                      onClick={() => onUnlink({ id: e.id, title: e.title })}
                      aria-label={t('savings.unlinkTitle')}
                      title={t('savings.unlinkTitle')}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
