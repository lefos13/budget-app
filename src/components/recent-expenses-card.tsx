'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CreditCard, ChevronRight, Plus, Trash2, Pencil } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { FromSavingsBadge } from '@/components/savings/from-savings-badge';
import { ItemRow, IconButton } from '@/components/ui/item-row';
import { CardHeader } from '@/components/ui/card-header';

export function RecentExpensesCard() {
  const { walletData, refreshWallet, showToast, setIsAddExpenseOpen, openEditExpense } = useApp();
  const { t, dateLocale } = useTranslation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!walletData || !walletData.recentExpenses) return null;

  const isViewer = walletData.userRole === 'VIEWER';
  const currency = walletData.wallet.currency;

  const handleDelete = async (id: string, title: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(interpolate(t('recentExpenses.deletedToast'), { title }));
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
        <CardHeader
          className="pb-4 border-b border-zinc-100 dark:border-zinc-800"
          icon={
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
          }
          title={t('recentExpenses.title')}
          description={t('recentExpenses.subtitle')}
          actions={
            <>
              <IconButton
                icon={Plus}
                onClick={() => setIsAddExpenseOpen(true)}
                aria-label={t('recentExpenses.addExpense')}
                className="border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
              />
              <Link
                href="/expenses"
                className="min-h-11 sm:min-h-0 px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                <span>{t('recentExpenses.viewAll')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </>
          }
        />

        <div className="mt-4 space-y-2.5">
          {walletData.recentExpenses.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t('recentExpenses.emptyTitle')}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{t('recentExpenses.emptySubtitle')}</p>
            </div>
          ) : (
            walletData.recentExpenses.slice(0, 6).map((exp) => {
              const isDeleting = deletingId === exp.id;
              return (
                <ItemRow
                  key={exp.id}
                  className="group p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                  leading={
                    exp.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exp.user.avatarUrl}
                        alt={exp.user.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-300 dark:ring-zinc-700 shadow-xs"
                        title={interpolate(t('recentExpenses.paidBy'), { name: exp.user.name })}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shadow-xs">
                        {/* i18n-ignore: Default avatar initial */}
                        {exp.user?.name?.slice(0, 1) || 'U'}
                      </div>
                    )
                  }
                  title={exp.title}
                  titleText={exp.title}
                  meta={
                    <>
                      <span>
                        {formatDate(exp.date, 'MMM d', dateLocale)} · {exp.user?.name.split(' ')[0]}
                      </span>
                      {exp.category && (
                        <span
                          className="text-chip font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `${exp.category.color}15`,
                            color: exp.category.color,
                          }}
                        >
                          {exp.category.name}
                        </span>
                      )}
                    </>
                  }
                  amount={
                    <span className="inline-flex flex-col items-end">
                      <span>-{formatCurrency(exp.amount, currency)}</span>
                      <FromSavingsBadge amount={exp.savingsFundedAmount} currency={currency} />
                    </span>
                  }
                  actions={
                    <>
                      {!isViewer && (
                        <IconButton
                          icon={Pencil}
                          onClick={() => openEditExpense(exp)}
                          aria-label={t('expenseEdit.edit')}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 sm:focus:opacity-100"
                        />
                      )}
                      <IconButton
                        icon={Trash2}
                        tone="rose"
                        disabled={isDeleting}
                        onClick={() => handleDelete(exp.id, exp.title)}
                        aria-label={t('recentExpenses.deleteExpense')}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      />
                    </>
                  }
                />
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
            {interpolate(t('recentExpenses.moreInList'), { count: walletData.recentExpenses.length - 6 })}
          </Link>
        </div>
      )}
    </div>
  );
}
