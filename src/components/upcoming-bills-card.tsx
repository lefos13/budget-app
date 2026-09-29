'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, ChevronRight, Plus, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { formatCurrency, formatRelativeDueDate, formatDate } from '@/lib/formatters';

export function UpcomingBillsCard() {
  const { walletData, currentUser, refreshWallet, showToast, setIsAddInvoiceOpen } = useApp();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'paid'>('pending');

  if (!walletData || !walletData.invoices) return null;

  const currency = walletData.wallet.currency;
  const pendingInvoices = walletData.invoices.filter((i) => i.status !== 'PAID');
  const paidInvoices = walletData.invoices.filter((i) => i.status === 'PAID');

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
        showToast(`Paid "${bill.title}"!`);
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
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/60 shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">Upcoming Bills & Invoices</h2>
              <p className="text-xs text-zinc-500">Scheduled reminders and due dates</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddInvoiceOpen(true)}
              className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Add Invoice"
            >
              <Plus className="w-4 h-4" />
            </button>
            <Link
              href="/calendar"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <span>Calendar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Tab switch: Pending vs Paid */}
        <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-xs w-fit">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              tab === 'pending'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Pending ({pendingInvoices.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('paid')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              tab === 'paid'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Paid ({paidInvoices.length})
          </button>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {displayedInvoices.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {tab === 'pending' ? 'All caught up!' : 'No paid bills yet'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {tab === 'pending'
                  ? 'No pending bills or invoices due in this wallet.'
                  : 'Bills marked as paid this month will appear here.'}
              </p>
            </div>
          ) : (
            displayedInvoices.slice(0, 5).map((bill) => {
              const { text: dueText, isOverdue } = formatRelativeDueDate(bill.dueDate);
              const isPaying = payingId === bill.id;
              const isPaid = bill.status === 'PAID';

              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {bill.title}
                      </p>
                      {bill.isRecurring && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                          {bill.recurrenceInterval.toLowerCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isPaid
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : isOverdue
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isPaid ? 'Paid' : dueText}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {formatDate(bill.dueDate, 'MMM d')}
                      </span>
                      {bill.invoiceNumber && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          #{bill.invoiceNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">
                      {formatCurrency(bill.amount, currency)}
                    </span>
                    {!isPaid ? (
                      <button
                        type="button"
                        disabled={isPaying}
                        onClick={() => handlePay(bill)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isPaying ? 'Saving...' : 'Pay'}</span>
                      </button>
                    ) : (
                      <span className="p-1 text-emerald-600 dark:text-emerald-400" title="Settled">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>
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
            +{displayedInvoices.length - 5} more bills in calendar
          </Link>
        </div>
      )}
    </div>
  );
}
