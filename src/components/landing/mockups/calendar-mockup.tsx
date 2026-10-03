'use client';

import { addDays, format, getDaysInMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarPlus, Repeat } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { mockWallet as w, mockDateISO } from './fixture';

const YEARLY_AMOUNT = 99;
const ICS_EXT = '.ics';

const card =
  'rounded-3xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_-8px_rgba(24,24,27,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-8px_rgba(0,0,0,0.6)]';

export function CalendarMockup() {
  const { t, dateLocale } = useTranslation();
  const m = t.landingMock;
  const money = (n: number) => formatCurrency(n, w.currency);

  const now = new Date();
  const first = startOfMonth(now);
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: getDaysInMonth(now) }, (_, i) => i + 1),
  ];
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(now, { weekStartsOn: 1 }), i), 'EEEEEE', { locale: dateLocale }),
  );
  const dueDots = new Map(
    w.bills.map((b) => [b.day, b.type === 'SUBSCRIPTION' ? 'bg-indigo-500' : 'bg-amber-500']),
  );

  const series = [
    { id: 'r1', label: m.billStreaming, cadence: m.cadenceMonthly, amount: money(w.bills[0].amount), paid: true, accent: 'bg-indigo-500' },
    { id: 'r2', label: m.billElectricity, cadence: m.cadenceMonthly, amount: money(w.bills[1].amount), paid: false, accent: 'bg-amber-500' },
    { id: 'r3', label: m.billCloud, cadence: m.cadenceYearly, amount: interpolate(m.perMonth, { amount: money(YEARLY_AMOUNT / 12) }), paid: true, accent: 'bg-emerald-500' },
  ];

  return (
    <div role="img" aria-label={m.calendarAriaLabel} className="relative mx-auto w-full max-w-xl">
      <div aria-hidden="true" className="relative pb-2 sm:pb-48">
        <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-br from-amber-400/10 via-indigo-500/10 to-sky-400/10 blur-2xl" />

        <div className={`${card} relative p-5 sm:w-[68%] sm:p-6`}>
          <p className="text-sm font-black capitalize text-zinc-900 dark:text-zinc-50">
            {format(now, 'LLLL yyyy', { locale: dateLocale })}
          </p>
          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
            {weekdays.map((d, i) => (
              <span key={i} className="text-[9px] font-black uppercase text-zinc-400">{d}</span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`e${i}`} />;
              const isToday = day === now.getDate();
              const dot = dueDots.get(day);
              return (
                <span
                  key={day}
                  className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums sm:h-8 sm:w-8 ${
                    isToday
                      ? 'bg-indigo-600 font-black text-white shadow-md shadow-indigo-500/30'
                      : 'text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {day}
                  {dot && <span className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${dot}`} />}
                </span>
              );
            })}
          </div>
        </div>

        <div className={`${card} mt-3 p-5 sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:w-[66%] sm:-rotate-1`}>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
            <Repeat size={12} />
            {m.recurringPayments}
          </p>
          <ul className="mt-3 space-y-2.5">
            {series.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <span className={`h-8 w-1 shrink-0 rounded-full ${s.accent}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-black text-zinc-800 dark:text-zinc-100">{s.label}</span>
                  <span className="text-[9px] font-bold text-zinc-400">{s.cadence}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[11px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">{s.amount}</span>
                  <span
                    className={`text-[9px] font-black ${
                      s.paid ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {s.paid
                      ? m.paid
                      : interpolate(m.dueOn, {
                          date: format(parseISO(mockDateISO(w.bills[1].day)), 'd MMM', { locale: dateLocale }),
                        })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-[10px] font-black text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 sm:absolute sm:right-2 sm:top-3 sm:mt-0">
          <CalendarPlus size={12} />
          {m.addToCalendar}
          <span className="rounded bg-white/20 px-1 text-[9px] dark:bg-zinc-900/10">{ICS_EXT}</span>
        </span>
      </div>
    </div>
  );
}
