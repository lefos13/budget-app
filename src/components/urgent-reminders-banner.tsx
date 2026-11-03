'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatRelativeDueDate, formatDate } from '@/lib/formatters';
import { getUrgentBills, isInvoiceOverdue } from '@/lib/bill-alerts';
import { compareMonthKeys, getCurrentMonthKey, formatMonthKey } from '@/lib/month';
import { ItemRow, RowPrimaryAction } from '@/components/ui/item-row';
import { CardHeader } from '@/components/ui/card-header';

export function UrgentRemindersBanner() {
  const pathname = usePathname();
  const { walletData, currentUser, refreshWallet, showToast } = useApp();
  const { t, dateLocale } = useTranslation();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!walletData || !walletData.invoices) return null;

  const urgentBills = getUrgentBills(walletData.invoices);

  if (urgentBills.length === 0) return null;

  const isViewer = walletData.userRole === 'VIEWER';

  const handlePay = async (bill: InvoiceItem) => {
    try {
      setPayingId(bill.id);

      const due = new Date(bill.dueDate);
      const billMonthKey = formatMonthKey(due.getFullYear(), due.getMonth());
      const isPastMonth = compareMonthKeys(billMonthKey, getCurrentMonthKey()) < 0;

      const payload = isPastMonth
        ? JSON.stringify({
            paidDate: due.toISOString().slice(0, 10),
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
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
        showToast(
          interpolate(t('urgent.paidToast'), {
            title: bill.title,
            amount: formatCurrency(bill.amount, walletData.wallet.currency),
          })
        );
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to pay bill:', err);
    } finally {
      setPayingId(null);
    }
  };

  const overdueCount = urgentBills.filter((b) => isInvoiceOverdue(b.dueDate) || b.status === 'OVERDUE').length;
  const displayedItems = showAll ? urgentBills : urgentBills.slice(0, 5);

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 transition-all shadow-sm ${
        overdueCount > 0
          ? 'bg-gradient-to-r from-rose-50/90 to-amber-50/50 dark:from-rose-950/30 dark:to-zinc-900/60 border-rose-200 dark:border-rose-900/60'
          : 'bg-gradient-to-r from-amber-50/90 to-yellow-50/40 dark:from-amber-950/30 dark:to-zinc-900/60 border-amber-200 dark:border-amber-900/60'
      }`}
    >
      <CardHeader
        className="pb-4 border-b border-rose-200/60 dark:border-rose-900/40"
        icon={
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              overdueCount > 0
                ? 'bg-rose-500 text-white shadow-rose-500/25'
                : 'bg-amber-500 text-white shadow-amber-500/25'
            }`}
          >
            {overdueCount > 0 ? (
              <AlertCircle className="w-5 h-5 animate-pulse" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
        }
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span>{overdueCount > 0 ? t('urgent.actionRequired') : t('urgent.dueSoon')}</span>
            <span
              className={`text-chip font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                overdueCount > 0
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
              }`}
            >
              {urgentBills.length === 1
                ? t('urgent.invoiceCountOne')
                : interpolate(t('urgent.invoiceCountMany'), { count: urgentBills.length })}
            </span>
          </div>
        }
        description={
          overdueCount > 0
            ? (overdueCount === 1
                ? t('urgent.overdueSubtitleOne')
                : interpolate(t('urgent.overdueSubtitleMany'), { count: overdueCount }))
            : t('urgent.dueSoonSubtitle')
        }
        actions={
          pathname !== '/calendar' ? (
            <Link
              href="/calendar"
              className="min-h-11 sm:min-h-0 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <span>{t('urgent.viewSchedule')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {t('urgent.highlightedBelow')}
            </span>
          )
        }
      />

      {/* Urgent bills list. No nested scroll area on phones; scrolls from sm. */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 sm:max-h-[32rem] sm:overflow-y-auto sm:pr-1">
        {displayedItems.map((bill) => {
          const { text: relativeText, isOverdue } = formatRelativeDueDate(bill.dueDate, t);
          const isPaying = payingId === bill.id;

          return (
            <ItemRow
              key={bill.id}
              className="p-3 rounded-2xl bg-white/95 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              title={bill.title}
              titleText={bill.title}
              amount={formatCurrency(bill.amount, walletData.wallet.currency)}
              meta={<span>{formatDate(bill.dueDate, 'MMM d', dateLocale)}</span>}
              status={
                <span
                  className={`text-chip font-bold px-1.5 py-0.5 rounded-md ${
                    isOverdue
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {relativeText}
                </span>
              }
              actions={
                !isViewer ? (
                  <RowPrimaryAction
                    icon={CheckCircle2}
                    disabled={isPaying}
                    onClick={() => handlePay(bill)}
                    aria-label={interpolate(t('common.markPaidAria'), { title: bill.title })}
                  >
                    {isPaying ? t.common.processing : t.common.markPaid}
                  </RowPrimaryAction>
                ) : undefined
              }
            />
          );
        })}
      </div>

      {urgentBills.length > 5 && (
        <div className="mt-3 pt-2.5 border-t border-rose-200/40 dark:border-rose-900/30 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            aria-expanded={showAll}
            className="min-h-11 sm:min-h-0 inline-flex items-center justify-center text-xs font-bold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
          >
            {showAll
              ? t('urgent.showLess')
              : interpolate(t('urgent.showAll'), { count: urgentBills.length })}
          </button>
        </div>
      )}
    </div>
  );
}
