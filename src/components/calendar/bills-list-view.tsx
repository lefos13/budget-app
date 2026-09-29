'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Repeat,
  Search,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';

export function BillsListView({
  typeFilter = 'ALL',
}: {
  typeFilter?: 'ALL' | 'BILL' | 'SUBSCRIPTION';
}) {
  const { walletData, currentUser, refreshWallet, showToast } = useApp();
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    if (!walletData) return [];
    let list = [...walletData.invoices];

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
  }, [walletData, typeFilter, statusFilter, search]);

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
            ? `Renewed subscription: "${bill.title}"`
            : `Paid bill: "${bill.title}"`
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
        showToast(`Deleted "${title}"`);
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
      {/* Search and Filters Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={t('bills.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-xs">
            {(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {st === 'ALL'
                  ? t('common.all')
                  : st === 'PENDING'
                  ? t('bills.pending')
                  : st === 'OVERDUE'
                  ? t('bills.overdue')
                  : t('bills.paid')}
              </button>
            ))}
          </div>
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
            Try adjusting your search query or filter settings.
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
              <div
                key={inv.id}
                className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSub
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800/60'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60'
                    }`}
                  >
                    {isSub ? <Repeat className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {inv.title}
                      </p>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                          isSub
                            ? 'bg-indigo-100/70 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        {isSub ? 'Subscription' : 'Bill'}
                      </span>
                      {inv.isRecurring && (
                        <span className="text-[10px] font-semibold text-zinc-400">
                          ({inv.recurrenceInterval.toLowerCase()})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
                      <span>Due: {formatDate(inv.dueDate, 'MMM d, yyyy')}</span>
                      {inv.category && (
                        <>
                          <span>·</span>
                          <span
                            className="font-bold px-1.5 py-0.5 rounded-md text-[10px]"
                            style={{
                              backgroundColor: `${inv.category.color}15`,
                              color: inv.category.color,
                            }}
                          >
                            {inv.category.name}
                          </span>
                        </>
                      )}
                      {inv.invoiceNumber && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-zinc-500">#{inv.invoiceNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">
                      {formatCurrency(inv.amount, currency)}
                    </p>
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${
                        isPaid
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : isOverdue
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                      }`}
                    >
                      {isPaid ? t('bills.paid') : isOverdue ? t('bills.overdue') : t('bills.pending')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isPaid && (
                      <button
                        type="button"
                        disabled={isPaying}
                        onClick={() => handlePay(inv)}
                        className={`px-2.5 py-1.5 rounded-xl text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                          isSub
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                        }`}
                      >
                        {isPaying ? t('common.processing') : t('bills.markAsPaidAction')}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(inv.id, inv.title)}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
