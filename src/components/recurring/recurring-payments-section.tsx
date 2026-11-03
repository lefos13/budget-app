'use client';

import React, { useState } from 'react';
import {
  Repeat,
  Sparkles,
  Flame,
  Plus,
  Trash2,
  Calendar,
  Pencil,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { useApp, type InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { isRecurringInvoice, monthlyEquivalent, pickNextOccurrences } from '@/lib/recurrence';
import { ItemRow, RowPrimaryAction, IconButton } from '@/components/ui/item-row';

export function RecurringPaymentsSection({ onAddSubscription }: { onAddSubscription?: () => void } = {}) {
  const { walletData, currentUser, refreshWallet, showToast, openAddInvoice, openEditInvoice } = useApp();
  const { t, dateLocale } = useTranslation();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!walletData) return null;

  const currency = walletData.wallet.currency;

  // Each payment rolls a recurring item forward into a new row: show one next occurrence per series.
  const recurring = pickNextOccurrences(walletData.invoices.filter(isRecurringInvoice));
  const subscriptions = recurring.filter((inv) => inv.type === 'SUBSCRIPTION');
  const recurringBills = recurring.filter((inv) => inv.type !== 'SUBSCRIPTION');

  // Monthly cost: one normalised amount per series, independent of payment state
  const monthlyCost = (items: InvoiceItem[]) =>
    items.reduce((sum, inv) => sum + monthlyEquivalent(inv.amount, inv.recurrenceInterval), 0);
  const subscriptionsCost = monthlyCost(subscriptions);
  const billsCost = monthlyCost(recurringBills);

  const handlePay = async (inv: InvoiceItem) => {
    try {
      setPayingId(inv.id);
      const res = await fetch(`/api/invoices/${inv.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
      });

      if (res.ok) {
        showToast(
          interpolate(
            t(inv.type === 'SUBSCRIPTION' ? 'bills.renewedSubscriptionToast' : 'bills.paidBillToast'),
            { title: inv.title }
          )
        );
        await refreshWallet();
      }
    } catch (err) {
      console.error('Error paying recurring item:', err);
    } finally {
      setPayingId(null);
    }
  };

  const handleDelete = async (inv: InvoiceItem) => {
    try {
      setDeletingId(inv.id);
      const res = await fetch(`/api/invoices?id=${inv.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(
          interpolate(
            t(inv.type === 'SUBSCRIPTION' ? 'bills.removedSubscriptionToast' : 'bills.deletedBillToast'),
            { title: inv.title }
          )
        );
        await refreshWallet();
      }
    } catch (err) {
      console.error('Error deleting recurring item:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const renderRow = (sub: InvoiceItem) => {
    const isPaying = payingId === sub.id;
    const isDeleting = deletingId === sub.id;
    const isPaid = sub.status === 'PAID';
    const isOverdue = sub.status === 'OVERDUE';
    const isSub = sub.type === 'SUBSCRIPTION';

    return (
      <ItemRow
        key={sub.id}
        className="p-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
        leading={
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isSub
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800/60'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60'
            }`}
          >
            {isSub ? <Repeat className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
        }
        title={sub.title}
        titleText={sub.title}
        amount={formatCurrency(sub.amount, currency)}
        badges={
          <>
            {sub.category && (
              <span
                className="text-chip font-bold px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${sub.category.color}15`,
                  color: sub.category.color,
                }}
              >
                {sub.category.name}
              </span>
            )}
            <span className="text-chip font-semibold text-zinc-600 dark:text-zinc-400 capitalize">
              {t.recurrence[sub.recurrenceInterval as keyof typeof t.recurrence] || sub.recurrenceInterval}
            </span>
          </>
        }
        meta={
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>{t('bills.nextColon')} </span>
            <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">
              {formatDate(sub.dueDate, 'MMM d, yyyy', dateLocale)}
            </strong>
          </span>
        }
        status={
          <span
            className={`inline-block text-chip font-bold px-2 py-0.5 rounded-full border ${
              isPaid
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                : isOverdue
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
            }`}
          >
            {isPaid ? t.bills.paid : isOverdue ? t.bills.overdue : t.bills.pending}
          </span>
        }
        actions={
          <>
            {!isPaid && (
              <RowPrimaryAction
                tone={isSub ? 'indigo' : 'emerald'}
                icon={CheckCircle2}
                disabled={isPaying}
                onClick={() => handlePay(sub)}
                aria-label={interpolate(t('common.markPaidAria'), { title: sub.title })}
                className="mr-1"
              >
                {isPaying ? t.common.processing : t.common.markPaid}
              </RowPrimaryAction>
            )}
            <IconButton
              icon={Pencil}
              tone="amber"
              onClick={() => openEditInvoice(sub)}
              aria-label={t('bills.edit')}
            />
            <IconButton
              icon={Trash2}
              tone="rose"
              disabled={isDeleting}
              onClick={() => handleDelete(sub)}
              aria-label={t.common.delete}
            />
          </>
        }
      />
    );
  };

  const renderColumn = ({
    icon,
    title,
    subtitle,
    note,
    items,
    cost,
    emptyText,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    note: React.ReactNode;
    items: InvoiceItem[];
    cost: number;
    emptyText: string;
  }) => (
    <section className="space-y-3 min-w-0">
      <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-start justify-between gap-1.5 min-[380px]:gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">{title}</h3>
              <span className="text-chip font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                {items.length}
              </span>
            </div>
            <p className="text-meta text-zinc-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <p className="text-sm font-black text-zinc-900 dark:text-white tabular-nums shrink-0 self-start min-[380px]:self-auto">
          {formatCurrency(cost, currency)}
          <span className="text-chip font-normal text-zinc-500 ml-1">{t.bills.perMonth}</span>
        </p>
      </div>

      <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 flex items-start gap-2 text-meta text-indigo-950 dark:text-indigo-200">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1">{note}</div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          {emptyText}
        </p>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
          {items.map(renderRow)}
        </div>
      )}
    </section>
  );

  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-4 sm:p-6 shadow-sm space-y-6">
      {/* Monthly Recurring Cost Indicator */}
      <div className="flex pb-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/30 p-3 sm:px-4 sm:py-2.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
            <Flame className="w-4 h-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <p className="text-chip font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              {t.bills.monthlyRecurringCost}
            </p>
            <p className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums leading-tight">
              {formatCurrency(subscriptionsCost + billsCost, currency)}
              <span className="text-meta font-normal text-zinc-500 ml-1">{t.bills.perMonth}</span>
            </p>
          </div>
        </div>
      </div>

      {recurring.length === 0 ? (
        <div className="text-center py-10 px-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50">
          <Repeat className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{t.bills.noSubscriptionsFound}</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">{t.bills.addFirstSubscription}</p>
          <button
            type="button"
            onClick={onAddSubscription || (() => openAddInvoice(undefined, 'SUBSCRIPTION'))}
            className="mt-4 min-h-11 sm:min-h-0 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.bills.addSubscription}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:divide-x lg:divide-zinc-100 dark:lg:divide-zinc-800">
          {renderColumn({
            icon: <Repeat className="w-4 h-4" />,
            title: t.bills.subscriptions,
            subtitle: t('bills.subscriptionsSubtitle'),
            note: (
              <>
                <strong className="font-semibold mr-1">{t('bills.decoupledSpending')}</strong>
                <span>{t.bills.subscriptionsNote}</span>
              </>
            ),
            items: subscriptions,
            cost: subscriptionsCost,
            emptyText: t.bills.noSubscriptionsFound,
          })}
          <div className="lg:pl-6">
            {renderColumn({
              icon: <FileText className="w-4 h-4" />,
              title: t.bills.recurringBills,
              subtitle: t.bills.recurringBillsSubtitle,
              note: t.bills.recurringBillsNote,
              items: recurringBills,
              cost: billsCost,
              emptyText: t.bills.noRecurringBills,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
