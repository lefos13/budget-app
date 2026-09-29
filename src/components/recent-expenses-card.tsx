'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CreditCard, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { formatCurrency, formatDate } from '@/lib/formatters';

export function RecentExpensesCard() {
  const { walletData, refreshWallet, showToast, setIsAddExpenseOpen } = useApp();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!walletData || !walletData.recentExpenses) return null;

  const currency = walletData.wallet.currency;

  const handleDelete = async (id: string, title: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted expense "${title}"`);
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">Recent Expenses</h2>
              <p className="text-xs text-zinc-500">Latest shared payments & receipts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(true)}
              className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Add Expense"
            >
              <Plus className="w-4 h-4" />
            </button>
            <Link
              href="/expenses"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {walletData.recentExpenses.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No expenses yet</p>
              <p className="text-xs text-zinc-500 mt-0.5">Click + to record the first payment in this wallet.</p>
            </div>
          ) : (
            walletData.recentExpenses.slice(0, 6).map((exp) => {
              const isDeleting = deletingId === exp.id;
              return (
                <div
                  key={exp.id}
                  className="group flex items-center justify-between p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {exp.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exp.user.avatarUrl}
                        alt={exp.user.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-zinc-300 dark:ring-zinc-700 shadow-xs"
                        title={`Paid by ${exp.user.name}`}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                        {exp.user?.name?.slice(0, 1) || 'U'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {exp.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {formatDate(exp.date, 'MMM d')} · {exp.user?.name.split(' ')[0]}
                        </span>
                        {exp.category && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${exp.category.color}15`,
                              color: exp.category.color,
                            }}
                          >
                            {exp.category.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">
                      -{formatCurrency(exp.amount, currency)}
                    </span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(exp.id, exp.title)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {walletData.recentExpenses.length > 6 && (
        <div className="pt-3 text-center border-t border-zinc-100 dark:border-zinc-800 mt-2">
          <Link
            href="/expenses"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            +{walletData.recentExpenses.length - 6} more in expenses list
          </Link>
        </div>
      )}
    </div>
  );
}
