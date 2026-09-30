import { format, parseISO } from 'date-fns';
import type { Locale } from 'date-fns';
import { el as elLocale, enUS } from 'date-fns/locale';
import type { TranslationFunction } from './i18n/translator';

import { en } from './i18n/dictionaries/en';

export { elLocale, enUS };

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `€${amount.toFixed(2)}`;
  }
}

export function formatDate(
  date: Date | string,
  formatPattern: string = 'MMM d, yyyy',
  locale?: Locale
): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatPattern, locale ? { locale } : undefined);
}

export function formatRelativeDueDate(
  date: Date | string,
  t?: TranslationFunction
): {
  text: string;
  isOverdue: boolean;
  isImminent: boolean;
} {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();

  // Reset hours for day comparisons
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = dDay.getTime() - nowDay.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (!t) {
    if (diffDays < 0) {
      return {
        // i18n-ignore: English fallback when no translator is passed
        text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`,
        isOverdue: true,
        isImminent: false,
      };
    } else if (diffDays === 0) {
      return {
        // i18n-ignore: English fallback when no translator is passed
        text: 'Due today',
        isOverdue: false,
        isImminent: true,
      };
    } else if (diffDays === 1) {
      return {
        // i18n-ignore: English fallback when no translator is passed
        text: 'Due tomorrow',
        isOverdue: false,
        isImminent: true,
      };
    } else if (diffDays <= 3) {
      return {
        // i18n-ignore: English fallback when no translator is passed
        text: `Due in ${diffDays} days`,
        isOverdue: false,
        isImminent: true,
      };
    } else {
      return {
        // i18n-ignore: English fallback when no translator is passed
        text: `Due in ${diffDays} days`,
        isOverdue: false,
        isImminent: false,
      };
    }
  }

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const tmpl = absDays === 1
      ? (t.relative?.overdueByDay || t('relative.overdueByDay'))
      : (t.relative?.overdueByDays || t('relative.overdueByDays'));
    return {
      text: tmpl.replace('{count}', String(absDays)),
      isOverdue: true,
      isImminent: false,
    };
  } else if (diffDays === 0) {
    return {
      text: t.relative?.dueToday || t('relative.dueToday'),
      isOverdue: false,
      isImminent: true,
    };
  } else if (diffDays === 1) {
    return {
      text: t.relative?.dueTomorrow || t('relative.dueTomorrow'),
      isOverdue: false,
      isImminent: true,
    };
  } else if (diffDays <= 3) {
    const tmpl = t.relative?.dueInDays || t('relative.dueInDays');
    return {
      text: tmpl.replace('{count}', String(diffDays)),
      isOverdue: false,
      isImminent: true,
    };
  } else {
    const tmpl = t.relative?.dueInDays || t('relative.dueInDays');
    return {
      text: tmpl.replace('{count}', String(diffDays)),
      isOverdue: false,
      isImminent: false,
    };
  }
}

export function calculateBudgetPacing(
  totalBudget: number,
  totalSpent: number,
  currentDate: Date = new Date()
): {
  percentageSpent: number;
  expectedPercentage: number;
  isOverPace: boolean;
  dailyBudgetRemaining: number;
  statusText: string;
  statusKey: 'exceeded' | 'overPace' | 'underPace' | 'healthy';
} {
  const totalDaysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();
  const currentDay = currentDate.getDate();

  const expectedPercentage = Math.round((currentDay / totalDaysInMonth) * 100);
  const percentageSpent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay);
  const budgetRemaining = Math.max(0, totalBudget - totalSpent);
  const dailyBudgetRemaining = budgetRemaining / daysRemaining;

  const isOverPace = percentageSpent > expectedPercentage + 5;

  let statusKey: 'exceeded' | 'overPace' | 'underPace' | 'healthy' = 'healthy';
  if (percentageSpent > 100) {
    statusKey = 'exceeded';
  } else if (isOverPace) {
    statusKey = 'overPace';
  } else if (percentageSpent < expectedPercentage - 10) {
    statusKey = 'underPace';
  }

  const statusText = en.pacing[statusKey];

  return {
    percentageSpent,
    expectedPercentage,
    isOverPace,
    dailyBudgetRemaining,
    statusText,
    statusKey,
  };
}
