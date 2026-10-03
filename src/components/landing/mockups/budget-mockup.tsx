'use client';

import { Gift, Gauge } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { mockWallet as w } from './fixture';

const BONUS = 300;
const DAILY_PACE = 40;
const available = w.monthlyBudget + BONUS;
const remaining = available - w.spent - w.saved;
const pct = (n: number) => `${(n / available) * 100}%`;

/** Envelope limits (local to the mockup). */
const LIMITS: Record<string, number> = { c1: 500, c2: 600, c3: 320 };
const ENVELOPES = w.categories.filter((c) => c.id in LIMITS);

const card =
  'rounded-3xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_-8px_rgba(24,24,27,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-8px_rgba(0,0,0,0.6)]';

export function BudgetMockup() {
  const { t } = useTranslation();
  const m = t.landingMock;
  const money = (n: number) => formatCurrency(n, w.currency);

  return (
    <div role="img" aria-label={m.budgetAriaLabel} className="relative mx-auto w-full max-w-xl">
      <div aria-hidden="true" className="relative pb-2 sm:pb-40">
        <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-br from-indigo-500/10 via-sky-400/10 to-emerald-400/10 blur-2xl" />

        <div className={`${card} relative bg-gradient-to-br from-white to-indigo-50/60 p-5 dark:from-zinc-900 dark:to-indigo-950/30 sm:p-6`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.monthlyBudget}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-4xl">{money(remaining)}</p>
              <p className="text-[11px] font-bold text-zinc-400">{interpolate(m.ofBudget, { amount: money(available) })}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              {m.onTrack}
            </span>
          </div>

          <div className="mt-5 flex h-3.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="bg-indigo-500" style={{ width: pct(w.spent) }} />
            <div className="bg-sky-400" style={{ width: pct(w.saved) }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
            {[
              { k: m.spent, v: w.spent, dot: 'bg-indigo-500' },
              { k: m.saved, v: w.saved, dot: 'bg-sky-400' },
              { k: m.left, v: remaining, dot: 'bg-zinc-300 dark:bg-zinc-600' },
            ].map((s) => (
              <div key={s.k} className="min-w-0">
                <span className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  <span className="truncate">{s.k}</span>
                </span>
                <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-zinc-100">{money(s.v)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/60">
            <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              <Gauge size={14} className="shrink-0 text-indigo-500" />
              <span className="truncate">{m.dailyPace}</span>
            </span>
            <span className="text-sm font-black tabular-nums text-zinc-900 dark:text-zinc-50">
              {interpolate(m.perDay, { amount: money(DAILY_PACE) })}
            </span>
          </div>

          <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-600 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20 sm:absolute sm:-top-3 sm:right-5 sm:mt-0 sm:shadow-lg">
            <Gift size={12} className="shrink-0" />
            <span className="truncate">{interpolate(m.bonusPill, { amount: money(BONUS) })}</span>
          </span>
        </div>

        <div className={`${card} mt-3 p-5 sm:absolute sm:-bottom-0 sm:right-0 sm:mt-0 sm:w-[78%] sm:rotate-1`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.envelopes}</p>
          <div className="mt-3 space-y-3">
            {ENVELOPES.map((c) => {
              const limit = LIMITS[c.id];
              const ratio = c.amount / limit;
              const near = ratio >= 0.85;
              return (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{m[c.labelKey]}</span>
                      {near && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                          {m.nearLimit}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-black text-zinc-900 dark:text-zinc-100">{money(c.amount)}</span>{' '}
                      <span className="text-zinc-400">{interpolate(m.ofLimit, { amount: money(limit) })}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${near ? 'bg-amber-500' : c.barClass}`}
                      style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
