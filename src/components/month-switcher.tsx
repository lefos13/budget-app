'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatMonthKey, getCurrentMonthKey, parseMonthKey } from '@/lib/month';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function MonthSwitcher({ className = '' }: { className?: string }) {
  const { selectedMonth, setSelectedMonth, goToPrevMonth, goToNextMonth, goToCurrentMonth } = useApp();
  const { language, t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => parseMonthKey(selectedMonth)?.year ?? new Date().getFullYear());

  const locale = language === 'el' ? 'el-GR' : 'en-US';
  const parsed = parseMonthKey(selectedMonth);
  const currentKey = getCurrentMonthKey();
  const isCurrent = selectedMonth === currentKey;

  const label = parsed
    ? capitalize(
        new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
          new Date(parsed.year, parsed.monthIndex, 1)
        )
      )
    : selectedMonth;

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    capitalize(new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2026, i, 1)))
  );

  const openPicker = () => {
    setPickerYear(parsed?.year ?? new Date().getFullYear());
    setIsOpen(true);
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  /* Touch target >= 44px on phones; compact from sm. */
  const iconButton =
    'size-11 sm:size-8 inline-flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer';

  return (
    <div className={`relative inline-flex ${className}`}>
      <div className="flex items-center gap-0.5 sm:gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 p-0.5 sm:p-1">
        <button
          type="button"
          onClick={goToPrevMonth}
          aria-label={t.month.previous}
          title={t.month.previous}
          className={iconButton}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={t.month.pickMonth}
          title={t.month.pickMonth}
          className="min-h-11 sm:min-h-8 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-900 dark:text-white hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5 min-w-[7.5rem] sm:min-w-[8.5rem] justify-center"
        >
          <span className="tabular-nums truncate">{label}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={goToNextMonth}
          aria-label={t.month.next}
          title={t.month.next}
          className={iconButton}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={goToCurrentMonth}
          disabled={isCurrent}
          className="min-h-11 sm:min-h-8 px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer text-indigo-600 dark:text-indigo-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent inline-flex items-center justify-center"
        >
          {t.month.today}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div
            role="dialog"
            aria-label={t.month.pickMonth}
            className="absolute left-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-30 p-3 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                aria-label={t.month.previousYear}
                className={iconButton}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                aria-label={t.month.nextYear}
                className={iconButton}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {monthNames.map((name, monthIndex) => {
                const key = formatMonthKey(pickerYear, monthIndex);
                const isSelected = key === selectedMonth;
                const isThisMonth = key === currentKey;
                return (
                  <button
                    key={key}
                    type="button"
                    title={isThisMonth ? t.month.thisMonthBadge : undefined}
                    onClick={() => {
                      setSelectedMonth(key);
                      setIsOpen(false);
                    }}
                    className={`min-h-11 sm:min-h-0 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    } ${isThisMonth && !isSelected ? 'ring-1 ring-indigo-400/70' : ''}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
