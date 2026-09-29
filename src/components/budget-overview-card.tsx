'use client';

import React from 'react';
import { TrendingUp, ShieldCheck, DollarSign, Calendar, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { formatCurrency, calculateBudgetPacing } from '@/lib/formatters';

export function BudgetOverviewCard() {
  const { walletData } = useApp();

  if (!walletData) return null;

  const { monthlyBudget, totalSpentMonth, remainingBudget } = walletData.metrics;
  const currency = walletData.wallet.currency;

  const pacing = calculateBudgetPacing(monthlyBudget, totalSpentMonth);

  const now = new Date();
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Sum of pending / overdue bills due up to the end of this month
  const committedBillsMonth = (walletData.invoices || [])
    .filter((inv) => {
      if (inv.status === 'PAID') return false;
      const due = new Date(inv.dueDate);
      return due <= endOfCurrentMonth;
    })
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Discretionary spend remaining after reserving for scheduled upcoming invoices
  const safeDiscretionarySpend = Math.max(0, remainingBudget - committedBillsMonth);

  return (
    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-7 shadow-sm">
      {/* Top Banner: Main Pacing Gauge & Daily Spend Allowance */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Monthly Budget Status
            </span>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                pacing.isOverPace
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
              }`}
            >
              {pacing.statusText}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white tabular-nums">
              {formatCurrency(totalSpentMonth, currency)}
            </h2>
            <span className="text-sm font-semibold text-zinc-500 tabular-nums">
              spent of {formatCurrency(monthlyBudget, currency)} target
            </span>
          </div>
        </div>

        {/* Daily Pacing Badge */}
        <div className="flex items-center gap-3.5 bg-zinc-50 dark:bg-zinc-800/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 self-start lg:self-auto shrink-0 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Remaining Daily Pace
            </p>
            <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
              {formatCurrency(pacing.dailyBudgetRemaining, currency)}
              <span className="text-xs font-medium text-zinc-400"> / day</span>
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar with Today's Milestone Marker */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-semibold mb-2 text-zinc-600 dark:text-zinc-400">
          <span className="font-bold text-zinc-900 dark:text-white">
            {pacing.percentageSpent}% Budget Spent
          </span>
          <span className="text-zinc-400">
            Day of month target: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{pacing.expectedPercentage}%</strong>
          </span>
        </div>

        <div className="relative w-full h-3.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          {/* Target Month Pace Marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-zinc-900 dark:bg-white z-10 shadow-sm ring-1 ring-zinc-300 dark:ring-zinc-600"
            style={{ left: `${Math.min(100, pacing.expectedPercentage)}%` }}
            title={`Pace expected today: ${pacing.expectedPercentage}%`}
          />
          {/* Actual Spent Bar */}
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pacing.percentageSpent > 100
                ? 'bg-rose-500'
                : pacing.isOverPace
                ? 'bg-amber-500'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${Math.min(100, pacing.percentageSpent)}%` }}
          />
        </div>
      </div>

      {/* 4 Financial Health Grid Cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Remaining Total */}
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Remaining Budget
            </p>
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1.5 tabular-nums">
            {formatCurrency(remainingBudget, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {100 - pacing.percentageSpent}% unallocated
          </p>
        </div>

        {/* Card 2: Upcoming Committed Bills */}
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Committed Bills
            </p>
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5 tabular-nums">
            {formatCurrency(committedBillsMonth, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {walletData.metrics.pendingCount} unpaid invoice{walletData.metrics.pendingCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* Card 3: Safe Discretionary Spend */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Safe Free Spend
            </p>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1.5 tabular-nums">
            {formatCurrency(safeDiscretionarySpend, currency)}
          </p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            After upcoming bills
          </p>
        </div>

        {/* Card 4: Collaborators Active */}
        <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Collaborators
            </p>
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5 tabular-nums">
            {walletData.wallet.members?.length || 1} members
          </p>
          <div className="flex items-center gap-1 mt-1">
            {walletData.wallet.members?.slice(0, 3).map((m, idx) => (
              <span key={idx} className="text-[10px] text-zinc-500 truncate">
                {m.user?.name.split(' ')[0]}
                {idx < Math.min(2, (walletData.wallet.members?.length || 1) - 1) ? ',' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
