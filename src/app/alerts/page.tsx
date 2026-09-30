'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  Calendar,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { UrgentRemindersBanner } from '@/components/urgent-reminders-banner';
import { UnpaidBillsBanner } from '@/components/unpaid-bills-banner';
import { MonthSwitcher } from '@/components/month-switcher';
import { getAlertSummary } from '@/lib/bill-alerts';

export default function AlertsPage() {
  const { walletData, isLoading, selectedMonth } = useApp();
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
          <Bell className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
          {t.wallet.noWalletSelected}
        </h1>
        <p className="text-sm text-zinc-500 mt-2 mb-6">
          {t.wallet.noWalletDesc}
        </p>
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

  const alertSummary = getAlertSummary(walletData.invoices, selectedMonth);
  const { distinctCount, hasOverdue } = alertSummary;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs shrink-0 ${
              hasOverdue
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/60'
                : distinctCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60'
            }`}
          >
            {hasOverdue ? (
              <AlertCircle className="w-6 h-6 animate-pulse" />
            ) : distinctCount > 0 ? (
              <Bell className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {t.alerts.pageTitle}
              </h1>
              {distinctCount > 0 && (
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    hasOverdue
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                  }`}
                >
                  {distinctCount > 99 ? '99+' : distinctCount}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t.alerts.pageSubtitle}
            </p>
          </div>
        </div>

        {/* Header Right: Navigation Links */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t.alerts.goToCalendar}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.alerts.goToOverview}</span>
          </Link>
        </div>
      </div>

      {/* Main Content: If 0 alerts exist across all categories -> Empty State */}
      {distinctCount === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-b from-emerald-50/80 via-white to-white dark:from-emerald-950/20 dark:via-zinc-900/90 dark:to-zinc-900 shadow-sm text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            {t.alerts.emptyTitle}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-2 leading-relaxed">
            {t.alerts.emptySubtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <MonthSwitcher />
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.alerts.goToCalendar}</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Urgent Reminders (Due soon or overdue) */}
          <UrgentRemindersBanner />

          {/* Section 2: Unpaid bills for selected month with carry-over */}
          <UnpaidBillsBanner alwaysRender />
        </div>
      )}
    </div>
  );
}
