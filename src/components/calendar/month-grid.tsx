'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency } from '@/lib/formatters';
import { toDateKey, parseMonthKey } from '@/lib/month';
import { DayAgendaDrawer } from './day-agenda-drawer';

export function MonthGrid({
  typeFilter = 'ALL',
  statusFilter = 'ALL',
  toolbar,
}: {
  typeFilter?: 'ALL' | 'BILL' | 'SUBSCRIPTION';
  statusFilter?: 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID';
  toolbar?: React.ReactNode;
}) {
  const {
    walletData,
    openAddInvoice,
    openAddExpense,
    selectedMonth,
  } = useApp();
  const { t, dateLocale } = useTranslation();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const parsedMonth = parseMonthKey(selectedMonth);
  const currentDate = useMemo(() => {
    if (parsedMonth) {
      return new Date(parsedMonth.year, parsedMonth.monthIndex, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [parsedMonth]);

  if (!walletData) return null;

  const currency = walletData.wallet.currency;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Invoices map by date string YYYY-MM-DD
  const invoicesByDate: Record<string, InvoiceItem[]> = {};
  walletData.invoices.forEach((inv) => {
    if (typeFilter === 'BILL' && inv.type === 'SUBSCRIPTION') return;
    if (typeFilter === 'SUBSCRIPTION' && inv.type !== 'SUBSCRIPTION') return;
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return;
    const key = new Date(inv.dueDate).toISOString().slice(0, 10);
    if (!invoicesByDate[key]) invoicesByDate[key] = [];
    invoicesByDate[key].push(inv);
  });

  // Calculate monthly calendar stats
  const targetYear = parsedMonth?.year ?? currentDate.getFullYear();
  const targetMonthIndex = parsedMonth?.monthIndex ?? currentDate.getMonth();

  const allInvoicesThisMonth = walletData.invoices.filter((inv) => {
    const d = new Date(inv.dueDate);
    return d.getUTCFullYear() === targetYear && d.getUTCMonth() === targetMonthIndex;
  });
  const pendingCount = allInvoicesThisMonth.filter((i) => i.status === 'PENDING').length;
  const overdueCount = allInvoicesThisMonth.filter((i) => i.status === 'OVERDUE').length;
  const paidCount = allInvoicesThisMonth.filter((i) => i.status === 'PAID').length;

  const pendingSum = allInvoicesThisMonth
    .filter((i) => i.status === 'PENDING')
    .reduce((s, i) => s + i.amount, 0);
  const overdueSum = allInvoicesThisMonth
    .filter((i) => i.status === 'OVERDUE')
    .reduce((s, i) => s + i.amount, 0);
  const paidSum = allInvoicesThisMonth
    .filter((i) => i.status === 'PAID')
    .reduce((s, i) => s + i.amount, 0);

  // Keying rule: Day cells and expenses use local toDateKey() to avoid timezone shift;
  // invoice dueDates are UTC-midnight date-only values keyed by ISO date slice.
  const expenseSumByDate: Record<string, number> = {};
  (walletData.monthExpenses || []).forEach((exp) => {
    const key = toDateKey(new Date(exp.date));
    expenseSumByDate[key] = (expenseSumByDate[key] || 0) + exp.amount;
  });

  const formatBillsCount = (count: number) =>
    count === 1
      ? interpolate(t('monthGrid.countBillsOne'), { count })
      : interpolate(t('monthGrid.countBillsMany'), { count });

  const getStatusLabel = (status: string) => {
    if (status === 'PAID') return t('bills.statusPaid');
    if (status === 'OVERDUE') return t('bills.statusOverdue');
    return t('bills.statusPending');
  };

  const weekDays = days.slice(0, 7).map((day) => ({
    key: day.toISOString(),
    label: format(day, 'EEE', { locale: dateLocale }),
  }));

  return (
    <div className="space-y-6">
      {/* Calendar Metrics Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            {t('monthGrid.totalMonthBills')}
          </p>
          <p className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mt-0.5 tabular-nums">
            {formatBillsCount(allInvoicesThisMonth.length)}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {interpolate(t('monthGrid.amountTotal'), { amount: formatCurrency(pendingSum + overdueSum + paidSum, currency) })}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              {t('monthGrid.pendingBills')}
            </p>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
            {formatBillsCount(pendingCount)}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {interpolate(t('monthGrid.amountDue'), { amount: formatCurrency(pendingSum, currency) })}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              {t('monthGrid.overdue')}
            </p>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
            {formatBillsCount(overdueCount)}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {interpolate(t('monthGrid.amountPastDue'), { amount: formatCurrency(overdueSum, currency) })}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              {t('monthGrid.paidSettled')}
            </p>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
            {formatBillsCount(paidCount)}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {interpolate(t('monthGrid.amountSettled'), { amount: formatCurrency(paidSum, currency) })}
          </p>
        </div>
      </div>

      {toolbar}

      {/* Grid Container */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 text-center py-2.5">
          {weekDays.map((day) => (
            <div key={day.key} className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              {day.label}
            </div>
          ))}
        </div>

        {/* Month Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-100 dark:divide-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800">
          {days.map((day) => {
            const dateStr = toDateKey(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const bills = invoicesByDate[dateStr] || [];
            const dayExpenseSum = expenseSumByDate[dateStr] || 0;

            const hasOverdue = bills.some((b) => b.status === 'OVERDUE');
            const hasPending = bills.some((b) => b.status === 'PENDING');
            const allPaid = bills.length > 0 && bills.every((b) => b.status === 'PAID');

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(day)}
                className={`min-h-[110px] sm:min-h-[130px] p-2 sm:p-2.5 transition-all cursor-pointer group flex flex-col justify-between ${
                  !isCurrentMonth
                    ? 'bg-zinc-50/40 dark:bg-zinc-950/40 opacity-40 hover:opacity-80'
                    : 'hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10'
                } ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}
              >
                {/* Cell Header: Day Number & Spend sum */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-zinc-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {dayExpenseSum > 0 && (
                    <span className="hidden sm:inline text-[10px] font-bold text-zinc-400 tabular-nums">
                      -{formatCurrency(dayExpenseSum, currency)}
                    </span>
                  )}
                </div>

                {/* Bill Events Badges */}
                <div className="mt-1.5 space-y-1 overflow-hidden flex-1">
                  {bills.slice(0, 2).map((bill) => {
                    const isPaid = bill.status === 'PAID';
                    const isOverdue = bill.status === 'OVERDUE';

                    return (
                      <React.Fragment key={bill.id}>
                        {/* Mobile compact indicator */}
                        <div
                          className={`sm:hidden h-1.5 rounded-full ${
                            isPaid
                              ? 'bg-emerald-500'
                              : isOverdue
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                          title={`${bill.title} - ${formatCurrency(bill.amount, currency)} (${getStatusLabel(bill.status)})`}
                        />
                        {/* Desktop full badge */}
                        <div
                          className={`hidden sm:flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate items-center justify-between border ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40'
                              : isOverdue
                              ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                          }`}
                          title={`${bill.title} - ${formatCurrency(bill.amount, currency)} (${getStatusLabel(bill.status)})`}
                        >
                          <span className="truncate">{bill.title}</span>
                          <span className="shrink-0 ml-1 font-bold tabular-nums">
                            {formatCurrency(bill.amount, currency)}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {bills.length > 2 && (
                    <div className="text-[9px] font-bold text-zinc-400 pl-1">
                      <span className="hidden sm:inline">
                        {bills.length - 2 === 1
                          ? interpolate(t('monthGrid.moreBillsOne'), { count: 1 })
                          : interpolate(t('monthGrid.moreBillsMany'), { count: bills.length - 2 })}
                      </span>
                      <span className="sm:hidden">+{bills.length - 2}</span>
                    </div>
                  )}
                </div>

                {/* Dot urgency indicator at bottom */}
                <div className="flex items-center gap-1 mt-1 pt-1">
                  {hasOverdue && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={t('monthGrid.overdueInvoice')} />
                  )}
                  {hasPending && !hasOverdue && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={t('monthGrid.pendingInvoice')} />
                  )}
                  {allPaid && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={t('bills.statusPaid')} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Drawer */}
      <DayAgendaDrawer
        selectedDate={selectedDate}
        onClose={() => setSelectedDate(null)}
        onAddBillForDate={(dateStr) => {
          setSelectedDate(null);
          openAddInvoice(dateStr, 'BILL');
        }}
        onAddExpenseForDate={(dateStr) => {
          setSelectedDate(null);
          openAddExpense(dateStr);
        }}
      />
    </div>
  );
}
