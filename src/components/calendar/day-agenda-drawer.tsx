'use client';

import React, { useState } from 'react';
import { Calendar, CheckCircle2, Plus, Receipt, FileText, Pencil } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toDateKey } from '@/lib/month';
import { Dialog } from '@/components/ui/dialog';
import { ItemRow, RowPrimaryAction, IconButton } from '@/components/ui/item-row';

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
  const { walletData, currentUser, refreshWallet, showToast, openEditInvoice, openEditExpense } = useApp();
  const { t, dateLocale } = useTranslation();
  const [payingId, setPayingId] = useState<string | null>(null);

  if (!selectedDate || !walletData) return null;

  const isViewer = walletData.userRole === 'VIEWER';
  const dateStr = toDateKey(selectedDate);
  const currency = walletData.wallet.currency;

  // Filter bills due on this date (invoices matched with the UTC ISO slice of dueDate)
  const billsOnDate = walletData.invoices.filter((inv) => {
    return new Date(inv.dueDate).toISOString().slice(0, 10) === dateStr;
  });

  // Filter expenses on this date (expenses source = walletData.monthExpenses, matched with toDateKey)
  const expensesOnDate = (walletData.monthExpenses || []).filter((exp) => {
    return toDateKey(new Date(exp.date)) === dateStr;
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
    <Dialog
      placement="right"
      size="md"
      onClose={onClose}
      title={formatDate(selectedDate, 'EEEE, MMMM d, yyyy', dateLocale)}
      description={t('agenda.title')}
      icon={
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
          <Calendar className="w-5 h-5" />
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>{t('agenda.totalForDate')}</span>
          <span className="text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
            {formatCurrency(totalBillsAmount + totalExpensesAmount, currency)}
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Bills Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                {interpolate(t('agenda.invoicesDue'), { count: billsOnDate.length })}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onAddBillForDate(dateStr)}
              className="min-h-11 sm:min-h-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('agenda.addBill')}</span>
            </button>
          </div>

          {billsOnDate.length === 0 ? (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
              <p className="text-xs text-zinc-500">{t('agenda.noInvoices')}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
              {billsOnDate.map((bill) => {
                const isPaying = payingId === bill.id;
                const isPaid = bill.status === 'PAID';
                const isOverdue = bill.status === 'OVERDUE';

                return (
                  <ItemRow
                    key={bill.id}
                    className="p-3.5"
                    leading={
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                          bill.type === 'SUBSCRIPTION'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800/60'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                    }
                    title={bill.title}
                    titleText={bill.title}
                    amount={formatCurrency(bill.amount, currency)}
                    badges={
                      <>
                        {bill.invoiceNumber && (
                          <span className="text-meta font-mono text-zinc-400">
                            #{bill.invoiceNumber}
                          </span>
                        )}
                        {bill.category && (
                          <span
                            className="text-chip font-bold px-1.5 py-0.5 rounded-md"
                            style={{ backgroundColor: `${bill.category.color}15`, color: bill.category.color }}
                          >
                            {bill.category.name}
                          </span>
                        )}
                      </>
                    }
                    meta={
                      bill.notes ? (
                        <span className="truncate">{bill.notes}</span>
                      ) : undefined
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
                        {isPaid ? t('bills.statusPaid') : isOverdue ? t('bills.statusOverdue') : t('bills.statusPending')}
                      </span>
                    }
                    actions={
                      <>
                        {!isPaid && (
                          <RowPrimaryAction
                            tone={bill.type === 'SUBSCRIPTION' ? 'indigo' : 'emerald'}
                            icon={CheckCircle2}
                            disabled={isPaying}
                            onClick={() => handlePay(bill)}
                            aria-label={interpolate(t('common.markPaidAria'), { title: bill.title })}
                            className="mr-1"
                          >
                            {isPaying ? t('common.processing') : t('common.markPaid')}
                          </RowPrimaryAction>
                        )}
                        <IconButton
                          icon={Pencil}
                          tone="amber"
                          onClick={() => {
                            onClose();
                            openEditInvoice(bill);
                          }}
                          aria-label={t('bills.edit')}
                        />
                      </>
                    }
                  />
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
                {interpolate(t('agenda.expensesLogged'), { count: expensesOnDate.length })}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onAddExpenseForDate(dateStr)}
              className="min-h-11 sm:min-h-0 text-meta font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('actions.addExpense')}</span>
            </button>
          </div>

          {expensesOnDate.length === 0 ? (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
              <p className="text-xs text-zinc-500">{t('agenda.noExpenses')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expensesOnDate.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {exp.title}
                    </p>
                    <p className="text-meta text-zinc-400 mt-0.5 break-words">
                      {exp.user?.name} · {exp.category?.name || t('bills.generalCategory')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-extrabold text-zinc-900 dark:text-white tabular-nums">
                      -{formatCurrency(exp.amount, currency)}
                    </span>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openEditExpense(exp);
                        }}
                        className="size-11 sm:size-8 inline-flex items-center justify-center rounded-xl text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={t('expenseEdit.edit')}
                        aria-label={t('expenseEdit.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
