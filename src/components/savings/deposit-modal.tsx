'use client';

import React, { useEffect, useState } from 'react';
import { PiggyBank, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getCurrentMonthKey, getMonthBounds, toDateKey } from '@/lib/month';

interface DepositModalProps {
  bucket: { id: string; name: string };
  /** Prefilled amount (the contribution still due); empty when nothing is due. */
  suggestedAmount: number;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

/** Records a deposit from the selected month's budget into a bucket (sub-bucket or General). */
export function DepositModal({ bucket, suggestedAmount, onClose, onDone }: DepositModalProps) {
  const { currentUser, walletData, selectedMonth, showToast } = useApp();
  const { t, dateLocale } = useTranslation();
  const currency = walletData?.wallet.currency || 'EUR';

  const [amount, setAmount] = useState(suggestedAmount > 0 ? suggestedAmount.toFixed(2) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  // Current month → deposit now; a past month → attribute it to that month's last day.
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();
  const monthLabel = formatDate(getMonthBounds(selectedMonth).start, 'MMMM yyyy', dateLocale);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/savings/${bucket.id}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(amount),
          ...(isCurrentMonth ? {} : { date: toDateKey(getMonthBounds(selectedMonth).end) }),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(translateApiError(json?.error, res.status, t));
        return;
      }
      showToast(
        interpolate(t('savings.depositedToast'), {
          amount: formatCurrency(parseFloat(amount), currency),
          bucket: bucket.name,
        })
      );
      await onDone();
      onClose();
    } catch {
      setErrorMessage(t('savings.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsed = parseFloat(amount);
  const canSubmit = Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-title"
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95"
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 id="deposit-title" className="text-base font-bold text-zinc-900 dark:text-white">
                {t('savings.depositTitle')}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {interpolate(t('savings.depositSubtitle'), { month: monthLabel, bucket: bucket.name })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t('common.close')}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
          <div>
            <label htmlFor="deposit-amount" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
              {`${t('savings.amountLabel')} (${currency})`}
            </label>
            <input
              id="deposit-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold text-zinc-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              autoFocus
            />
          </div>

          {errorMessage && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('common.processing') : t('savings.depositButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
