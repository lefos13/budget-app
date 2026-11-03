'use client';

import React, { useState } from 'react';
import { ArrowRightLeft, Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getCurrentMonthKey, getMonthBounds, toDateKey } from '@/lib/month';

interface MoveMoneyModalProps {
  /** MOVE: between buckets (budget-neutral). BOOST: General → this month's budget. */
  mode: 'MOVE' | 'BOOST';
  from: { id: string; name: string; balance: number };
  /** Destinations for MOVE (General + other active buckets). */
  destinations?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

export function MoveMoneyModal({ mode, from, destinations = [], onClose, onDone }: MoveMoneyModalProps) {
  const { currentUser, walletData, selectedMonth, showToast } = useApp();
  const { t, dateLocale } = useTranslation();
  const currency = walletData?.wallet.currency || 'EUR';
  const isBoost = mode === 'BOOST';

  const [amount, setAmount] = useState('');
  const [toId, setToId] = useState(destinations[0]?.id ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const parsed = parseFloat(amount);
  const exceeds = Number.isFinite(parsed) && parsed > from.balance + 1e-9;
  const canSubmit = Number.isFinite(parsed) && parsed > 0 && !exceeds && (isBoost || Boolean(toId));
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();
  const monthLabel = formatDate(getMonthBounds(selectedMonth).start, 'MMMM yyyy', dateLocale);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/savings/${from.id}/${isBoost ? 'boost' : 'transfer'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(
          isBoost
            ? { amount: parsed, ...(isCurrentMonth ? {} : { date: toDateKey(getMonthBounds(selectedMonth).end) }) }
            : { amount: parsed, toBucketId: toId }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(translateApiError(json?.error, res.status, t));
        return;
      }
      const formatted = formatCurrency(parsed, currency);
      showToast(
        isBoost
          ? interpolate(t('savings.boostedToast'), { amount: formatted })
          : interpolate(t('savings.movedToast'), {
              amount: formatted,
              bucket: destinations.find((d) => d.id === toId)?.name ?? '',
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

  return (
    <Dialog
      onClose={onClose}
      size="sm"
      dismissible={!isSubmitting}
      onSubmit={handleSubmit}
      title={isBoost ? t('savings.boostTitle') : interpolate(t('savings.moveTitle'), { bucket: from.name })}
      description={isBoost ? interpolate(t('savings.boostSubtitle'), { month: monthLabel }) : t('savings.moveSubtitle')}
      icon={
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60">
          {isBoost ? <Wallet className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-sm sm:text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('common.processing') : isBoost ? t('savings.boostButton') : t('savings.moveButton')}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          {!isBoost && (
            <div>
              <label htmlFor="move-to" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
                {t('savings.moveTo')}
              </label>
              <select
                id="move-to"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="move-amount" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
              {`${t('savings.amountLabel')} (${currency})`}
            </label>
            <input
              id="move-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={from.balance}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold text-zinc-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              autoFocus
            />
            <p className={`text-meta mt-1 tabular-nums ${exceeds ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
              {`${t('savings.balance')}: ${formatCurrency(from.balance, currency)}`}
            </p>
          </div>

          {errorMessage && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {errorMessage}
            </p>
          )}

        </div>
    </Dialog>
  );
}
