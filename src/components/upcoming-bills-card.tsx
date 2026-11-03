'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, ChevronRight, Plus, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatRelativeDueDate, formatDate } from '@/lib/formatters';
import { getMonthBounds } from '@/lib/month';
import { ItemRow, RowPrimaryAction, IconButton } from '@/components/ui/item-row';
import { CardHeader } from '@/components/ui/card-header';

export function UpcomingBillsCard() {
  const { walletData, currentUser, refreshWallet, showToast, openAddInvoice, selectedMonth } = useApp();
  const { t, dateLocale } = useTranslation();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'paid'>('pending');

  if (!walletData || !walletData.invoices) return null;

  const currency = walletData.wallet.currency;
  const { start: monthStart, end: monthEnd } = getMonthBounds(selectedMonth);
  const monthInvoices = walletData.invoices.filter((i) => {
    const due = new Date(i.dueDate);
    return due >= monthStart && due <= monthEnd;
  });
  const pendingInvoices = monthInvoices.filter((i) => i.status !== 'PAID');
  const paidInvoices = monthInvoices.filter((i) => i.status === 'PAID');

  const displayedInvoices = tab === 'pending' ? pendingInvoices : paidInvoices;

  const handlePay = async (bill: InvoiceItem) => {
    try {
      setPayingId(bill.id);
      const res = await fetch(`/api/invoices/${bill.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
      });

      if (res.ok) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        showToast(interpolate(t('upcoming.paidToast'), { title: bill.title }));
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to mark invoice as paid:', err);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      <div>
        <CardHeader
          className="pb-4 border-b border-zinc-100 dark:border-zinc-800"
          icon={
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/60 shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
          }
          title={t('upcoming.title')}
          description={t('upcoming.subtitle')}
          actions={
            <>
              <IconButton
                icon={Plus}
                onClick={() => openAddInvoice(undefined, 'BILL')}
                aria-label={t('upcoming.addInvoice')}
                className="border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
              />
              <Link
                href="/calendar"
                className="min-h-11 sm:min-h-0 px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                <span>{t('upcoming.calendar')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </>
          }
        />

        {/* Tab switch: Pending vs Paid */}
        <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-xs w-fit">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`min-h-11 sm:min-h-0 px-3 py-1 rounded-lg font-bold transition-all ${
              tab === 'pending'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {interpolate(t('upcoming.tabPending'), { count: pendingInvoices.length })}
          </button>
          <button
            type="button"
            onClick={() => setTab('paid')}
            className={`min-h-11 sm:min-h-0 px-3 py-1 rounded-lg font-bold transition-all ${
              tab === 'paid'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {interpolate(t('upcoming.tabPaid'), { count: paidInvoices.length })}
          </button>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {displayedInvoices.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {tab === 'pending' ? t('upcoming.allCaughtUp') : t('upcoming.noPaidYet')}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {tab === 'pending'
                  ? t('upcoming.noPendingDesc')
                  : t('upcoming.noPaidDesc')}
              </p>
            </div>
          ) : (
            displayedInvoices.slice(0, 5).map((bill) => {
              const { text: dueText, isOverdue } = formatRelativeDueDate(bill.dueDate, t);
              const isPaying = payingId === bill.id;
              const isPaid = bill.status === 'PAID';

              return (
                <ItemRow
                  key={bill.id}
                  className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  title={bill.title}
                  titleText={bill.title}
                  amount={formatCurrency(bill.amount, currency)}
                  badges={
                    bill.isRecurring ? (
                      <span className="text-chip font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                        {t.recurrence[bill.recurrenceInterval as keyof typeof t.recurrence] ?? bill.recurrenceInterval}
                      </span>
                    ) : undefined
                  }
                  meta={
                    <>
                      <span>{formatDate(bill.dueDate, 'MMM d', dateLocale)}</span>
                      {bill.invoiceNumber && <span className="font-mono">#{bill.invoiceNumber}</span>}
                    </>
                  }
                  status={
                    <span
                      className={`text-chip font-bold px-1.5 py-0.5 rounded-md ${
                        isPaid
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : isOverdue
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {isPaid ? t.bills.statusPaid : dueText}
                    </span>
                  }
                  actions={
                    !isPaid ? (
                      <RowPrimaryAction
                        icon={CheckCircle2}
                        disabled={isPaying}
                        onClick={() => handlePay(bill)}
                        aria-label={interpolate(t('common.markPaidAria'), { title: bill.title })}
                      >
                        {isPaying ? t.common.processing : t.common.markPaid}
                      </RowPrimaryAction>
                    ) : (
                      <span className="p-1 text-emerald-600 dark:text-emerald-400" title={t('upcoming.settled')}>
                        <Check className="w-4 h-4" />
                      </span>
                    )
                  }
                />
              );
            })
          )}
        </div>
      </div>

      {displayedInvoices.length > 5 && (
        <div className="pt-3 text-center border-t border-zinc-100 dark:border-zinc-800 mt-2">
          <Link
            href="/calendar"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {interpolate(t('upcoming.moreBillsInCalendar'), { count: displayedInvoices.length - 5 })}
          </Link>
        </div>
      )}
    </div>
  );
}
