'use client';

import { addMonths, format } from 'date-fns';
import { ArrowDown, ArrowUp, CalendarClock, PiggyBank, Plane } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { mockWallet as w } from './fixture';
import { useLandingToday } from '../landing-today';

const general = w.buckets.find((b) => b.labelKey === 'general')!;
const goal = w.buckets.find((b) => b.labelKey === 'goalSummerTrip')!;
const goalTarget = goal.target ?? 0;
const ratio = Math.min(goal.balance / goalTarget, 1);
const MONTHLY_CONTRIBUTION = 75;
// Months left to reach the target at the monthly rate; the linked expense lands in that future month.
const MONTHS_AHEAD = Math.ceil((goalTarget - goal.balance) / MONTHLY_CONTRIBUTION);

const card =
  'rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05),0_12px_32px_-8px_rgba(24,24,27,0.14)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-10px_rgba(0,0,0,0.6)]';

function ProgressRing({ ratio: value }: { ratio: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-zinc-100 dark:stroke-zinc-800" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        className="stroke-sky-500"
      />
    </svg>
  );
}

export function SavingsMockup() {
  const { t, dateLocale } = useTranslation();
  const m = t.landingMock;
  const money = (n: number) => formatCurrency(n, w.currency);
  const today = useLandingToday();
  const targetMonth = format(addMonths(today, MONTHS_AHEAD), 'LLLL', { locale: dateLocale });

  return (
    <div role="img" aria-label={m.savingsAriaLabel} className="relative mx-auto w-full max-w-xl">
      <div aria-hidden="true" className="relative px-1 pb-2 pt-2">
        <div className="pointer-events-none absolute inset-x-6 top-10 bottom-0 -z-10 rounded-full bg-gradient-to-br from-sky-200/50 via-indigo-200/40 to-emerald-200/40 blur-3xl dark:from-sky-500/10 dark:via-indigo-500/10 dark:to-emerald-500/10" />

        {/* General bucket */}
        <div className={`${card} relative w-[72%] -rotate-1 p-4 sm:w-[60%] sm:p-5`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <PiggyBank size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-zinc-400">{m[general.labelKey]}</p>
              <p className="text-[10px] font-bold text-zinc-400">{m.bucketBalance}</p>
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{money(general.balance)}</p>
        </div>

        {/* Move money chip */}
        <div className="relative z-10 -my-3 ml-[22%] sm:ml-[34%]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-black text-indigo-600 shadow-lg shadow-indigo-500/15 dark:border-indigo-500/30 dark:bg-zinc-900 dark:text-indigo-300">
            <ArrowUp size={12} />
            {m.moveMoney}
            <ArrowDown size={12} />
          </span>
        </div>

        {/* Goal bucket */}
        <div className={`${card} relative ml-auto w-[94%] rotate-1 bg-gradient-to-br from-white to-sky-50/70 p-4 dark:from-zinc-900 dark:to-sky-950/30 sm:w-[84%] sm:p-5`}>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
              <ProgressRing ratio={ratio} />
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-50">{Math.round(ratio * 100)}%</span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                {m.bucketGoal}
              </span>
              <p className="mt-1 truncate text-sm font-black text-zinc-800 dark:text-zinc-100">{m[goal.labelKey]}</p>
              <p className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{money(goal.balance)}</p>
              <p className="text-[11px] font-bold text-zinc-400">{interpolate(m.ofTarget, { amount: money(goalTarget) })}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Plane size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-black text-zinc-800 dark:text-zinc-100">
                {m.plannedFlights} · {targetMonth}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-zinc-400">
                <CalendarClock size={10} />
                {m.linkedExpense}
              </span>
            </span>
            <span className="text-[11px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">{money(goalTarget)}</span>
          </div>

          <p className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            {interpolate(m.perMonthOnTrack, { amount: money(MONTHLY_CONTRIBUTION) })}
          </p>
        </div>
      </div>
    </div>
  );
}
