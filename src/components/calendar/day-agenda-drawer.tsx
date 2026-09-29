'use client';

import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, Plus, Receipt, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface DayAgendaDrawerProps {
  selectedDate: Date | null;
  onClose: () => void;
  onAddBillForDate: (dateStr: string) => void;
  onAddExpenseForDate: (dateStr: string) => void;
}

export function DayAgendaDrawer({
  selectedDate,
  onClose,
  onAddBillForDate,
  onAddExpenseForDate,
}: DayAgendaDrawerProps) {
  const { walletData, currentUser, refreshWallet, showToast } = useApp();
  const [payingId, setPayingId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selectedDate || !walletData) return null;

  const dateStr = selectedDate.toISOString().slice(0, 10);
  const currency = walletData.wallet.currency;

  // Filter bills due on this date
  const billsOnDate = walletData.invoices.filter((inv) => {
    return new Date(inv.dueDate).toISOString().slice(0, 10) === dateStr;
  });

  // Filter expenses on this date
  const expensesOnDate = walletData.recentExpenses.filter((exp) => {
    return new Date(exp.date).toISOString().slice(0, 10) === dateStr;
  });

  const totalBillsAmount = billsOnDate.reduce((sum, b) => sum + b.amount, 0);
  const totalExpensesAmount = expensesOnDate.reduce((sum, e) => sum + e.amount, 0);

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
          origin: { y: 0.6 },
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
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-zinc-950/50 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Daily Agenda & Due Bills
              </p>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Bills Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  Invoices Due ({billsOnDate.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onAddBillForDate(dateStr)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bill</span>
              </button>
            </div>

            {billsOnDate.length === 0 ? (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-xs text-zinc-500">No invoices due on this date.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {billsOnDate.map((bill) => {
                  const isPaying = payingId === bill.id;
                  const isPaid = bill.status === 'PAID';
                  const isOverdue = bill.status === 'OVERDUE';

                  return (
                    <div
                      key={bill.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isPaid
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                          : isOverdue
                          ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                          : 'bg-zinc-50/70 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">
                            {bill.title}
                          </p>
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
                              {bill.status}
                            </span>
                            {bill.invoiceNumber && (
                              <span className="text-[10px] text-zinc-400 font-mono">
                                #{bill.invoiceNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-sm font-extrabold text-zinc-900 dark:text-white shrink-0">
                          {formatCurrency(bill.amount, currency)}
                        </span>
                      </div>

                      {bill.notes && (
                        <p className="text-[11px] text-zinc-500 mt-2 bg-white/60 dark:bg-zinc-900/60 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                          {bill.notes}
                        </p>
                      )}

                      {!isPaid && (
                        <div className="mt-3 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800 flex justify-end">
                          <button
                            type="button"
                            disabled={isPaying}
                            onClick={() => handlePay(bill)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isPaying ? 'Processing...' : 'Mark as Paid'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expenses Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                  Expenses Logged ({expensesOnDate.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onAddExpenseForDate(dateStr)}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Expense
              </button>
            </div>

            {expensesOnDate.length === 0 ? (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-xs text-zinc-500">No expenses recorded on this day.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expensesOnDate.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                        {exp.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {exp.user?.name} · {exp.category?.name || 'General'}
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                      -{formatCurrency(exp.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>Total for this date</span>
          <span className="text-sm font-bold text-zinc-900 dark:text-white">
            {formatCurrency(totalBillsAmount + totalExpensesAmount, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
