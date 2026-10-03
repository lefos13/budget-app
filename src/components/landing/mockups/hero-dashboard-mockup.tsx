'use client';

import { format, parseISO } from 'date-fns';
import { LayoutDashboard, CalendarDays, PiggyBank, Repeat, Users, Wallet } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { BrowserFrame } from './browser-frame';
import { PhoneFrame } from './phone-frame';
import { mockWallet as w, mockDateISO } from './fixture';

const remaining = w.monthlyBudget - w.spent - w.saved;
const pct = (n: number) => `${(n / w.monthlyBudget) * 100}%`;
const maxCat = Math.max(...w.categories.map((c) => c.amount));
const NAV_ICONS = [LayoutDashboard, CalendarDays, Repeat, PiggyBank, Users];

const card =
  'rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900';

function RingGauge({ ratio }: { ratio: number }) {
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
        strokeDasharray={`${c * ratio} ${c}`}
        className="stroke-indigo-500"
      />
    </svg>
  );
}

export function HeroDashboardMockup() {
  const { t, dateLocale } = useTranslation();
  const m = t.landingMock;
  const money = (n: number) => formatCurrency(n, w.currency);
  const dayLabel = (day: number, pattern = 'd MMM') =>
    format(parseISO(mockDateISO(day)), pattern, { locale: dateLocale });

  const desktop = (
    <BrowserFrame url={m.appUrl}>
      <div className="flex bg-zinc-50/60 dark:bg-zinc-950">
        <div className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Wallet size={14} />
          </div>
          {NAV_ICONS.map((Icon, i) => (
            <div
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${i === 0 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-zinc-400'}`}
            >
              <Icon size={14} />
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-5 gap-3 p-4">
          <div className={`${card} col-span-3 bg-gradient-to-br from-white to-indigo-50/60 p-5 dark:from-zinc-900 dark:to-indigo-950/30`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.remaining}</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{money(remaining)}</p>
                <p className="text-[11px] font-bold text-zinc-400">{interpolate(m.ofBudget, { amount: money(w.monthlyBudget) })}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                {m.onTrack}
              </span>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="bg-indigo-500" style={{ width: pct(w.spent) }} />
              <div className="bg-sky-400" style={{ width: pct(w.saved) }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
              {[
                { k: m.spent, v: w.spent, dot: 'bg-indigo-500' },
                { k: m.saved, v: w.saved, dot: 'bg-sky-400' },
                { k: m.left, v: remaining, dot: 'bg-zinc-300 dark:bg-zinc-600' },
              ].map((s) => (
                <div key={s.k}>
                  <span className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.k}
                  </span>
                  <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-zinc-100">{money(s.v)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} col-span-2 p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.upcomingBills}</p>
            <ul className="mt-3 space-y-2.5">
              {w.bills.map((b) => (
                <li key={b.id} className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-100 text-[9px] font-black uppercase leading-tight text-zinc-500 dark:bg-zinc-800">
                    <span className="text-xs text-zinc-900 dark:text-zinc-100">{dayLabel(b.day, 'd')}</span>
                    {dayLabel(b.day, 'MMM')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black text-zinc-800 dark:text-zinc-100">{m[b.labelKey]}</span>
                    <span className={`text-[9px] font-bold ${b.type === 'SUBSCRIPTION' ? 'text-indigo-500' : 'text-amber-500'}`}>
                      {b.type === 'SUBSCRIPTION' ? m.subscription : m.bill}
                    </span>
                  </span>
                  <span className="text-[11px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">{money(b.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${card} col-span-5 p-5`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.categories}</p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
              {w.categories.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                    <span>{m[c.labelKey]}</span>
                    <span className="font-black tabular-nums">{money(c.amount)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className={`h-full rounded-full ${c.barClass}`} style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );

  const mobile = (
    <PhoneFrame>
      <div className="space-y-3 px-4 pb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.overview}</p>
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 shrink-0">
            <RingGauge ratio={(w.spent + w.saved) / w.monthlyBudget} />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black tabular-nums text-zinc-900 dark:text-zinc-50">
              {Math.round(((w.spent + w.saved) / w.monthlyBudget) * 100)}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-zinc-400">{m.remaining}</p>
            <p className="text-xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{money(remaining)}</p>
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              {m.onTrack}
            </span>
          </div>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="bg-indigo-500" style={{ width: pct(w.spent) }} />
          <div className="bg-sky-400" style={{ width: pct(w.saved) }} />
        </div>
        <p className="pt-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.recentExpenses}</p>
        <ul className="space-y-2">
          {w.recentExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span>
                <span className="block text-[11px] font-black text-zinc-800 dark:text-zinc-100">{m[e.categoryKey]}</span>
                <span className="text-[9px] font-bold text-zinc-400">{dayLabel(e.day)}</span>
              </span>
              <span className="text-[11px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">−{money(e.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </PhoneFrame>
  );

  return (
    <div role="img" aria-label={m.ariaLabel} className="relative mx-auto w-full max-w-5xl">
      <div aria-hidden="true">
        <div className="mock-float mx-auto w-[240px] max-w-full md:hidden">{mobile}</div>
        <div className="hidden pb-16 pr-16 md:block">
          {desktop}
          <div className="mock-float absolute -bottom-2 right-0 w-[200px] rotate-3 lg:w-[220px]">{mobile}</div>
        </div>
      </div>
    </div>
  );
}
