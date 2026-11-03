'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Repeat,
  Search,
  Trash2,
  Calendar,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getMonthBounds } from '@/lib/month';
import { ItemRow, RowPrimaryAction, IconButton } from '@/components/ui/item-row';

export function BillsListView({
  typeFilter = 'ALL',
  statusFilter = 'ALL',
}: {
  typeFilter?: 'ALL' | 'BILL' | 'SUBSCRIPTION';
  statusFilter?: 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID';
}) {
  const { walletData, currentUser, refreshWallet, showToast, selectedMonth, openEditInvoice } = useApp();
  const { t, dateLocale } = useTranslation();

  const [search, setSearch] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    if (!walletData) return [];
    const { start, end } = getMonthBounds(selectedMonth);
    const startMs = start.getTime();
    const endMs = end.getTime();

    let list = walletData.invoices.filter((i) => {
      const dueMs = new Date(i.dueDate).getTime();
      return dueMs >= startMs && dueMs <= endMs;
    });

    // Filter by type
    if (typeFilter === 'BILL') {
      list = list.filter((i) => i.type !== 'SUBSCRIPTION');
    } else if (typeFilter === 'SUBSCRIPTION') {
      list = list.filter((i) => i.type === 'SUBSCRIPTION');
    }

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter((i) => i.status === statusFilter);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.notes && i.notes.toLowerCase().includes(q)) ||
          (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(q))
      );
    }

    // Sort by dueDate
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return list;
  }, [walletData, selectedMonth, typeFilter, statusFilter, search]);

  if (!walletData) return null;
  const currency = walletData.wallet.currency;

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
        showToast(
          bill.type === 'SUBSCRIPTION'
            ? interpolate(t('bills.renewedSubscriptionToast'), { title: bill.title })
            : interpolate(t('bills.paidBillToast'), { title: bill.title })
        );
        await refreshWallet();
      }
    } catch (err) {
      console.error('Error paying invoice:', err);
    } finally {
      setPayingId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/invoices?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(interpolate(t('bills.deletedBillToast'), { title }));
        await refreshWallet();
      }
    } catch (err) {
      console.error('Error deleting bill:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={t('bills.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table list */}
      {filteredBills.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Calendar className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
            {t('bills.noBillsFound')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {t('bills.noBillsMatchingSub')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filteredBills.map((inv) => {
            const isSub = inv.type === 'SUBSCRIPTION';
            const isPaid = inv.status === 'PAID';
            const isOverdue = inv.status === 'OVERDUE';
            const isPaying = payingId === inv.id;
            const isDeleting = deletingId === inv.id;

            return (
              <ItemRow
                key={inv.id}
                className="px-4 sm:px-5 py-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
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
                title={inv.title}
                titleText={inv.title}
                amount={formatCurrency(inv.amount, currency)}
                badges={
                  <>
                    <span
                      className={`text-chip font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                        isSub
                          ? 'bg-indigo-100/70 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {isSub ? t('unpaidBanner.typeSubscription') : t('unpaidBanner.typeBill')}
                    </span>
                    {inv.isRecurring && (
                      <span className="text-chip font-semibold">
                        {t.recurrence[inv.recurrenceInterval as keyof typeof t.recurrence] || inv.recurrenceInterval}
                      </span>
                    )}
                    {inv.category && (
                      <span
                        className="text-chip font-bold px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: `${inv.category.color}15`, color: inv.category.color }}
                      >
                        {inv.category.name}
                      </span>
                    )}
                  </>
                }
                meta={
                  <>
                    <span>
                      {t('bills.dueColon')} {formatDate(inv.dueDate, 'MMM d, yyyy', dateLocale)}
                    </span>
                    {inv.invoiceNumber && <span className="font-mono">#{inv.invoiceNumber}</span>}
                  </>
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
                    {isPaid ? t('bills.paid') : isOverdue ? t('bills.overdue') : t('bills.pending')}
                  </span>
                }
                actions={
                  <>
                    {!isPaid && (
                      <RowPrimaryAction
                        tone={isSub ? 'indigo' : 'emerald'}
                        icon={CheckCircle2}
                        disabled={isPaying}
                        onClick={() => handlePay(inv)}
                        aria-label={interpolate(t('common.markPaidAria'), { title: inv.title })}
                        className="mr-1"
                      >
                        {isPaying ? t('common.processing') : t('common.markPaid')}
                      </RowPrimaryAction>
                    )}
                    <IconButton
                      icon={Pencil}
                      tone="amber"
                      onClick={() => openEditInvoice(inv)}
                      aria-label={t('bills.edit')}
                    />
                    <IconButton
                      icon={Trash2}
                      tone="rose"
                      disabled={isDeleting}
                      onClick={() => handleDelete(inv.id, inv.title)}
                      aria-label={t('common.delete')}
                    />
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
