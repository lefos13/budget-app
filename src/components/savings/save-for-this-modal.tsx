'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PiggyBank, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  getCurrentMonthKey,
  getMonthKey,
  parseMonthKey,
  addMonthsToKey,
  compareMonthKeys,
} from '@/lib/month';
import type { SavingsBucketView } from './use-savings';

export const BUCKET_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6'];

export interface LinkablePlanned {
  id: string;
  title: string;
  amount: number;
  expectedDate: string;
  trackFromMonth?: string | null;
}

interface SaveForThisModalProps {
  planned: LinkablePlanned;
  buckets: SavingsBucketView[];
  onClose: () => void;
  onLinked: () => void | Promise<void>;
}

/** Links a future planned expense to an existing savings bucket or creates a new bucket for it. */
export function SaveForThisModal({ planned, buckets, onClose, onLinked }: SaveForThisModalProps) {
  const { currentUser, walletData, showToast } = useApp();
  const { t, dateLocale } = useTranslation();
  const currency = walletData?.wallet.currency || 'EUR';

  const [mode, setMode] = useState<'EXISTING' | 'NEW'>(buckets.length > 0 ? 'EXISTING' : 'NEW');
  const [bucketId, setBucketId] = useState(buckets[0]?.id ?? '');
  const [name, setName] = useState(planned.title.slice(0, 60));
  const [color, setColor] = useState(BUCKET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableTrackMonths = useMemo(() => {
    if (!planned.expectedDate) return [];
    const expDate = new Date(planned.expectedDate);
    if (isNaN(expDate.getTime())) return [];
    const expMonth = getMonthKey(expDate);
    const startKey = getCurrentMonthKey();
    const months: Array<{ key: string; label: string }> = [];
    let cur = startKey;
    while (compareMonthKeys(cur, expMonth) <= 0) {
      const parsed = parseMonthKey(cur);
      if (parsed) {
        const d = new Date(parsed.year, parsed.monthIndex, 1);
        months.push({
          key: cur,
          label: formatDate(d, 'MMMM yyyy', dateLocale),
        });
      }
      cur = addMonthsToKey(cur, 1);
    }
    return months;
  }, [planned.expectedDate, dateLocale]);

  const [trackFromMonth, setTrackFromMonth] = useState<string>(() => planned.trackFromMonth ?? '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const payload = {
      ...(mode === 'NEW' ? { newBucket: { name: name.trim(), color } } : { bucketId }),
      trackFromMonth: trackFromMonth || null,
    };
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/planned-expenses/${planned.id}/savings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(translateApiError(json?.error, res.status, t));
        return;
      }
      showToast(interpolate(t('savings.linkedToast'), { title: planned.title, bucket: json.bucket?.name ?? '' }));
      await onLinked();
      onClose();
    } catch {
      setErrorMessage(t('savings.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = mode === 'NEW' ? name.trim().length > 0 && name.trim().length <= 60 : Boolean(bucketId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-for-this-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 id="save-for-this-title" className="text-base font-bold text-zinc-900 dark:text-white">
                {t('savings.saveForThisTitle')}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {interpolate(t('savings.saveForThisSubtitle'), {
                  title: planned.title,
                  amount: formatCurrency(planned.amount, currency),
                  date: formatDate(planned.expectedDate, 'MMM yyyy', dateLocale),
                })}
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
          {buckets.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/70">
              {(['EXISTING', 'NEW'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    mode === m
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {m === 'EXISTING' ? t('savings.existingBucket') : t('savings.newBucket')}
                </button>
              ))}
            </div>
          )}

          {mode === 'EXISTING' ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">{t('savings.existingBucket')}</legend>
              {buckets.map((b) => (
                <label
                  key={b.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    bucketId === b.id
                      ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="radio"
                      name="bucket"
                      value={b.id}
                      checked={bucketId === b.id}
                      onChange={() => setBucketId(b.id)}
                      className="accent-emerald-600"
                    />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{b.name}</span>
                  </span>
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                    {interpolate(t('savings.savedOfTarget'), {
                      saved: formatCurrency(b.balance, currency),
                      target: formatCurrency(b.target, currency),
                    })}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="bucket-name" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  {t('savings.newBucketName')}
                </label>
                <input
                  id="bucket-name"
                  type="text"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
              </div>
              <div>
                <span className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">{t('savings.color')}</span>
                <div className="flex items-center gap-2" role="radiogroup" aria-label={t('savings.color')}>
                  {BUCKET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {availableTrackMonths.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 space-y-1.5">
              <label
                htmlFor="save-for-this-track-from"
                className="block text-xs font-bold text-emerald-900 dark:text-emerald-200"
              >
                {t('savings.trackFromMonth')}
              </label>
              <select
                id="save-for-this-track-from"
                value={trackFromMonth || availableTrackMonths[0]?.key || ''}
                onChange={(e) => setTrackFromMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {availableTrackMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {t('savings.trackFromMonthHelp')}
              </p>
            </div>
          )}

          {errorMessage && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
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
              {isSubmitting ? t('common.processing') : t('savings.linkButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
