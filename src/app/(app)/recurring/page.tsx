'use client';

import React from 'react';
import Link from 'next/link';
import { Layers, Plus, Repeat, Wallet } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { RecurringPaymentsSection } from '@/components/recurring/recurring-payments-section';

export default function RecurringPage() {
  const { isLoading, walletData, openAddInvoice } = useApp();
  const { t } = useTranslation();

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8" />
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

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs shrink-0">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {t.nav.recurring}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('bills.recurringPageSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openAddInvoice(undefined, 'SUBSCRIPTION')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.bills.addSubscription}</span>
          </button>
          <button
            type="button"
            onClick={() => openAddInvoice(undefined, 'BILL', true)}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.bills.addRecurringBill}</span>
          </button>
        </div>
      </div>

      {/* Recurring Payments Catalogue */}
      <RecurringPaymentsSection onAddSubscription={() => openAddInvoice(undefined, 'SUBSCRIPTION')} />
    </div>
  );
}
