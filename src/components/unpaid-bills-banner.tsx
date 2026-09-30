'use client';

import React, { useState } from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  getCurrentMonthKey,
  compareMonthKeys,
  formatMonthKey,
} from '@/lib/month';
import { getUnpaidForMonth, isInvoiceOverdue } from '@/lib/bill-alerts';
import { MonthSwitcher } from '@/components/month-switcher';

export function UnpaidBillsBanner({ alwaysRender = false }: { alwaysRender?: boolean }) {
  const { walletData, selectedMonth, setSelectedMonth, refreshWallet, showToast, currentUser } =
    useApp();
  const { t, dateLocale } = useTranslation();

  const [payingId, setPayingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!walletData || !walletData.invoices) return null;

  const currency = walletData.wallet?.currency || 'EUR';
  const isViewer = walletData.userRole === 'VIEWER';

  const { monthItems, carryOverItems, monthTotal, carryOverTotal } = getUnpaidForMonth(
    walletData.invoices,
    selectedMonth
  );

  if (!alwaysRender && monthItems.length === 0 && carryOverItems.length === 0) {
    return null;
  }

  const earliestDue = carryOverItems.length > 0 ? new Date(carryOverItems[0].dueDate) : null;
  const earliestMonthKey = earliestDue
    ? formatMonthKey(earliestDue.getUTCFullYear(), earliestDue.getUTCMonth())
    : null;

  const displayedItems = showAll ? monthItems : monthItems.slice(0, 5);

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const handlePay = async (bill: InvoiceItem) => {
    try {
      setPayingId(bill.id);
      const isPastMonth = compareMonthKeys(selectedMonth, getCurrentMonthKey()) < 0;

      const payload = isPastMonth
        ? JSON.stringify({
            paidDate: new Date(bill.dueDate).toISOString().slice(0, 10),
          })
        : undefined;

      const headers: Record<string, string> = {};
      if (payload) {
        headers['Content-Type'] = 'application/json';
      }
      if (currentUser?.id) {
        headers['x-user-id'] = currentUser.id;
      }

      const res = await fetch(`/api/invoices/${bill.id}/pay`, {
        method: 'POST',
        headers,
        ...(payload ? { body: payload } : {}),
      });

      if (res.ok) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });

        const toastMsg = isPastMonth
          ? t('unpaidBanner.paidToastPast')
              .replace('{title}', bill.title)
              .replace('{month}', selectedMonth)
          : t('unpaidBanner.paidToast').replace('{title}', bill.title);

        showToast(toastMsg);
        await refreshWallet();
      } else {
        if (res.status === 403) {
          showToast(t('unpaidBanner.errorForbidden'));
        } else {
          showToast(t('unpaidBanner.errorGeneric'));
        }
      }
    } catch (err) {
      console.error('Failed to mark invoice as paid:', err);
      showToast(t('unpaidBanner.errorGeneric'));
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-amber-200/90 dark:border-amber-900/60 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-zinc-900/60 p-5 sm:p-6 shadow-sm transition-all">
      {/* Header: Title, Count Badge, MonthSwitcher, Total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-amber-200/60 dark:border-amber-900/40 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs shadow-amber-500/25">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white">
              {t('unpaidBanner.title')}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60">
              {t('unpaidBanner.countLabel').replace('{count}', String(monthItems.length))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
          <MonthSwitcher />
          <div className="text-sm font-black text-amber-950 dark:text-amber-100 tabular-nums">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-1.5">
              {t('unpaidBanner.total')}
            </span>
            {formatCurrency(monthTotal, currency)}
          </div>
        </div>
      </div>

      {/* Month Items List or Empty Message */}
      <div className="mt-3.5 space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
        {monthItems.length === 0 ? (
          <p className="text-xs font-medium text-amber-800/90 dark:text-amber-300/80 italic py-1">
            {t('unpaidBanner.nothingLeft')}
          </p>
        ) : (
          displayedItems.map((bill) => {
            const isPaying = payingId === bill.id;
            const dueTime = new Date(bill.dueDate).getTime();
            const isOverdue =
              dueTime < startOfToday || isInvoiceOverdue(bill.dueDate) || bill.status === 'OVERDUE';

            return (
              <div
                key={bill.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-amber-200/70 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800 transition-all gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {bill.title}
                    </span>
                    {/* Small type badge */}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        bill.type === 'SUBSCRIPTION'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60'
                          : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                      }`}
                    >
                      {bill.type === 'SUBSCRIPTION'
                        ? t('unpaidBanner.typeSubscription')
                        : t('unpaidBanner.typeBill')}
                    </span>
                    {/* Category chip if any */}
                    {bill.category && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 truncate max-w-[120px]"
                        title={bill.category.name}
                      >
                        {bill.category.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {formatDate(bill.dueDate, 'MMM d', dateLocale)}
                    </span>
                    {isOverdue && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60">
                        {t('unpaidBanner.overdue')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white tabular-nums">
                    {formatCurrency(bill.amount, currency)}
                  </span>
                  {!isViewer && (
                    <button
                      type="button"
                      disabled={isPaying}
                      onClick={() => handlePay(bill)}
                      aria-label={`${t('unpaidBanner.markPaid')}: ${bill.title}`}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {isPaying ? t('unpaidBanner.paying') : t('unpaidBanner.markPaid')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Show All / Show Less Toggle */}
      {monthItems.length > 5 && (
        <div className="pt-2.5 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            aria-expanded={showAll}
            className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
          >
            {showAll
              ? t('unpaidBanner.showLess')
              : t('unpaidBanner.showAll').replace('{count}', String(monthItems.length))}
          </button>
        </div>
      )}

      {/* Carry-over line */}
      {carryOverItems.length > 0 && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 ${
            monthItems.length > 0 ? 'mt-3 border-t border-amber-200/60 dark:border-amber-900/40' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {t('unpaidBanner.carryOver')
                .replace('{count}', String(carryOverItems.length))
                .replace('{total}', formatCurrency(carryOverTotal, currency))}
            </span>
          </div>
          {earliestMonthKey && (
            <button
              type="button"
              onClick={() => setSelectedMonth(earliestMonthKey)}
              aria-label={`${t('unpaidBanner.review')}: ${earliestMonthKey}`}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-amber-200/80 hover:bg-amber-300/80 dark:bg-amber-900/50 dark:hover:bg-amber-900/80 text-amber-950 dark:text-amber-200 font-bold text-xs transition-colors cursor-pointer shrink-0"
            >
              {t('unpaidBanner.review')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
