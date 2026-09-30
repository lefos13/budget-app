'use client';

import React, { useEffect, useState } from 'react';
import { Landmark, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { formatCurrency } from '@/lib/formatters';

interface AdjustGeneralModalProps {
  generalId: string;
  direction: 'IN' | 'OUT';
  /** Current General balance, used to cap removals client-side (the API enforces it too). */
  balance: number;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

/** Manual add / remove on General savings; budget-neutral. */
export function AdjustGeneralModal({ generalId, direction, balance, onClose, onDone }: AdjustGeneralModalProps) {
  const { currentUser, walletData, showToast } = useApp();
  const { t } = useTranslation();
  const currency = walletData?.wallet.currency || 'EUR';

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const parsed = parseFloat(amount);
  const isOut = direction === 'OUT';
  const exceeds = isOut && Number.isFinite(parsed) && parsed > balance + 1e-9;
  const canSubmit = Number.isFinite(parsed) && parsed > 0 && !exceeds;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/savings/${generalId}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ direction, amount: parsed, note: note.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(translateApiError(json?.error, res.status, t));
        return;
      }
      showToast(
        interpolate(t(isOut ? 'savings.adjustedOutToast' : 'savings.adjustedInToast'), {
          amount: formatCurrency(parsed, currency),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-general-title"
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95"
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 id="adjust-general-title" className="text-base font-bold text-zinc-900 dark:text-white">
                {t(isOut ? 'savings.adjustOutTitle' : 'savings.adjustInTitle')}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">{t('savings.adjustSubtitle')}</p>
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
            <label htmlFor="adjust-amount" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
              {`${t('savings.amountLabel')} (${currency})`}
            </label>
            <input
              id="adjust-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              max={isOut ? balance : undefined}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold text-zinc-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              autoFocus
            />
            {isOut && (
              <p className={`text-[11px] mt-1 tabular-nums ${exceeds ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'}`}>
                {`${t('savings.balance')}: ${formatCurrency(balance, currency)}`}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="adjust-note" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
              {t('savings.noteLabel')}
            </label>
            <input
              id="adjust-note"
              type="text"
              maxLength={200}
              value={note}
              placeholder={t('savings.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
              className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isOut ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? t('common.processing') : t(isOut ? 'savings.removeMoney' : 'savings.addMoney')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
