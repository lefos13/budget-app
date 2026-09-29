'use client';

import React from 'react';
import { Tag, ShoppingCart, Home, Zap, Utensils, Tv, Car, HeartPulse, Film, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/formatters';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Zap,
  ShoppingCart,
  Utensils,
  Tv,
  Car,
  HeartPulse,
  Film,
  Tag,
};

export function CategoryBreakdown() {
  const { walletData } = useApp();

  if (!walletData || !walletData.categories) return null;

  const currency = walletData.wallet.currency;

  const overCount = walletData.categories.filter((c) => (c.monthlyLimit || 0) > 0 && (c.spent || 0) > (c.monthlyLimit || 0)).length;
  const warningCount = walletData.categories.filter((c) => {
    const lim = c.monthlyLimit || 0;
    const sp = c.spent || 0;
    if (lim <= 0) return false;
    const pct = (sp / lim) * 100;
    return pct >= 85 && pct <= 100;
  }).length;

  return (
    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 sm:p-7 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">Category Budgets & Envelopes</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {walletData.categories.length} categories
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Monitor spend caps across household and personal categories
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          {overCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{overCount} exceeded limit</span>
            </span>
          ) : warningCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{warningCount} near limit</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>All envelopes on track</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {walletData.categories.map((cat) => {
          const Icon = iconMap[cat.icon] || Tag;
          const limit = cat.monthlyLimit || 0;
          const spent = cat.spent || 0;
          const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
          const isWarning = percentage >= 85 && percentage <= 100;
          const isExceeded = percentage > 100;
          const remaining = limit - spent;

          return (
            <div
              key={cat.id}
              className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {cat.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                      isExceeded
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                        : isWarning
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                        : 'bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {limit > 0 ? `${percentage}%` : 'No Limit'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-xs font-bold mt-2">
                  <span className="text-zinc-900 dark:text-white tabular-nums">
                    {formatCurrency(spent, currency)}
                  </span>
                  <span className="text-zinc-400 font-medium tabular-nums">
                    {limit > 0 ? `of ${formatCurrency(limit, currency)}` : 'Flexible'}
                  </span>
                </div>
              </div>

              {/* Progress bar and remaining allowance */}
              <div className="mt-3">
                <div className="w-full h-2 bg-zinc-200/80 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : ''
                    }`}
                    style={{
                      backgroundColor: isExceeded ? undefined : isWarning ? undefined : cat.color,
                      width: `${Math.min(100, percentage)}%`,
                    }}
                  />
                </div>

                {limit > 0 && (
                  <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5 flex justify-between tabular-nums">
                    <span>
                      {isExceeded
                        ? `${formatCurrency(Math.abs(remaining), currency)} over`
                        : `${formatCurrency(remaining, currency)} left`}
                    </span>
                    <span className="text-zinc-400">
                      {isExceeded ? 'Exceeded' : `${100 - Math.min(100, percentage)}% remaining`}
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
