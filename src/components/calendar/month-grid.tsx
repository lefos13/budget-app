'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Download,
  Plus,
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
  addMonths,
  subMonths,
  format,
} from 'date-fns';
import { useApp, InvoiceItem } from '@/context/AppContext';
import { formatCurrency } from '@/lib/formatters';
import { DayAgendaDrawer } from './day-agenda-drawer';
import { IcsExportModal } from './ics-export-modal';

export function MonthGrid({
  typeFilter = 'ALL',
}: {
  typeFilter?: 'ALL' | 'BILL' | 'SUBSCRIPTION';
}) {
  const { walletData, setIsAddInvoiceOpen, openAddInvoice, openAddExpense } = useApp();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [isIcsModalOpen, setIsIcsModalOpen] = useState(false);

  if (!walletData) return null;

  const currency = walletData.wallet.currency;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

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
  const allInvoicesThisMonth = walletData.invoices.filter((inv) => {
    const d = new Date(inv.dueDate);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
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

  // Expenses map by date string
  const expenseSumByDate: Record<string, number> = {};
  walletData.recentExpenses.forEach((exp) => {
    const key = new Date(exp.date).toISOString().slice(0, 10);
    expenseSumByDate[key] = (expenseSumByDate[key] || 0) + exp.amount;
  });

  const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      {/* Calendar Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              {format(currentDate, 'MMMM yyyy')}
            </h1>
            <p className="text-xs text-zinc-500">
              Manage invoice payment reminders & bill schedules
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 p-1 text-xs">
            {(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === filter
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Prev / Today / Next Controls */}
          <div className="flex items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 p-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sync .ICS */}
          <button
            type="button"
            onClick={() => setIsIcsModalOpen(true)}
            className="px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="Sync with Apple or Google Calendar"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync .ICS</span>
          </button>

          {/* Add Bill */}
          <button
            type="button"
            onClick={() => setIsAddInvoiceOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bill</span>
          </button>
        </div>
      </div>

      {/* Calendar Metrics Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Total Month Bills
          </p>
          <p className="text-base sm:text-lg font-black text-zinc-900 dark:text-white mt-0.5 tabular-nums">
            {allInvoicesThisMonth.length} bills
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {formatCurrency(pendingSum + overdueSum + paidSum, currency)} total
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending Bills
            </p>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
            {pendingCount} bills
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {formatCurrency(pendingSum, currency)} due
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Overdue
            </p>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
            {overdueCount} bills
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {formatCurrency(overdueSum, currency)} past due
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Paid Settled
            </p>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
            {paidCount} bills
          </p>
          <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
            {formatCurrency(paidSum, currency)} settled
          </p>
        </div>
      </div>

      {/* Grid Container */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 text-center py-2.5">
          {weekDayNames.map((name) => (
            <div key={name} className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              {name}
            </div>
          ))}
        </div>

        {/* Month Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-100 dark:divide-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800">
          {days.map((day) => {
            const dateStr = day.toISOString().slice(0, 10);
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
                          title={`${bill.title} - ${formatCurrency(bill.amount, currency)} (${bill.status})`}
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
                          title={`${bill.title} - ${formatCurrency(bill.amount, currency)} (${bill.status})`}
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
                      <span className="hidden sm:inline">+{bills.length - 2} more bill{bills.length - 2 === 1 ? '' : 's'}</span>
                      <span className="sm:hidden">+{bills.length - 2}</span>
                    </div>
                  )}
                </div>

                {/* Dot urgency indicator at bottom */}
                <div className="flex items-center gap-1 mt-1 pt-1">
                  {hasOverdue && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Overdue Invoice" />
                  )}
                  {hasPending && !hasOverdue && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Pending Invoice" />
                  )}
                  {allPaid && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Paid" />
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
          openAddInvoice(dateStr);
        }}
        onAddExpenseForDate={(dateStr) => {
          setSelectedDate(null);
          openAddExpense(dateStr);
        }}
      />

      {/* .ICS Export Modal */}
      <IcsExportModal
        isOpen={isIcsModalOpen}
        onClose={() => setIsIcsModalOpen(false)}
      />
    </div>
  );
}
