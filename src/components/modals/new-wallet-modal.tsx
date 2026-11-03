'use client';

import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';

export function NewWalletModal() {
  const {
    isNewWalletOpen,
    setIsNewWalletOpen,
    currentUser,
    refreshWallets,
    setActiveWalletId,
    showToast,
  } = useApp();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [monthlyBudget, setMonthlyBudget] = useState('2000');
  const [color, setColor] = useState('#6366f1');
  const [isSubmitting, setIsSubmitting] = useState(false);


  if (!isNewWalletOpen) return null;

  const colorOptions = [
    '#6366f1', // Indigo
    '#0ea5e9', // Sky
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          currency,
          monthlyBudget: parseFloat(monthlyBudget) || 2000,
          color,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(interpolate(t('wallet.createdToast'), { name }));
        setIsNewWalletOpen(false);
        setName('');
        await refreshWallets();
        if (data.wallet?.id) {
          setActiveWalletId(data.wallet.id);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(translateApiError(data.error, res.status, t));
      }
    } catch (err) {
      console.error('Failed to create wallet:', err);
      showToast(translateApiError(undefined, undefined, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      onClose={() => setIsNewWalletOpen(false)}
      dismissible={!isSubmitting}
      onSubmit={handleSubmit}
      title={t.wallet.createNew}
      description={t.wallet.newWalletSubtitle}
      icon={
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50">
          <Wallet className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => setIsNewWalletOpen(false)}
            className="px-4 py-2.5 rounded-xl text-sm sm:text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-xs font-semibold shadow-md shadow-indigo-600/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t.wallet.creating : t.wallet.createButton}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t.wallet.walletNameRequiredLabel}
            </label>
            <input
              type="text"
              required
              placeholder={t.wallet.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t.wallet.monthlyBudgetRequiredLabel}
              </label>
              <input
                type="number"
                step="10"
                min="10"
                required
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t.wallet.currencyLabel}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="EUR">{t.currencies.EUR}</option>
                <option value="USD">{t.currencies.USD}</option>
                <option value="GBP">{t.currencies.GBP}</option>
                <option value="CHF">{t.currencies.CHF}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t.wallet.themeColorLabel}
            </label>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="flex size-11 sm:size-7 items-center justify-center rounded-full cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className={`block size-7 sm:size-full rounded-full transition-transform ${
                      color === c ? 'scale-110 ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                </button>
              ))}
            </div>
          </div>

        </div>
    </Dialog>
  );
}
