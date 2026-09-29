import { format, parseISO } from 'date-fns';

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

export function formatDate(date: Date | string, formatPattern: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatPattern);
}

export function formatRelativeDueDate(date: Date | string): {
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

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`,
      isOverdue: true,
      isImminent: false,
    };
  } else if (diffDays === 0) {
    return {
      text: 'Due today',
      isOverdue: false,
      isImminent: true,
    };
  } else if (diffDays === 1) {
    return {
      text: 'Due tomorrow',
      isOverdue: false,
      isImminent: true,
    };
  } else if (diffDays <= 3) {
    return {
      text: `Due in ${diffDays} days`,
      isOverdue: false,
      isImminent: true,
    };
  } else {
    return {
      text: `Due in ${diffDays} days`,
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

  let statusText = 'Pacing healthy';
  if (percentageSpent > 100) {
    statusText = 'Budget exceeded';
  } else if (isOverPace) {
    statusText = 'Spending faster than expected';
  } else if (percentageSpent < expectedPercentage - 10) {
    statusText = 'Under budget pace';
  }

  return {
    percentageSpent,
    expectedPercentage,
    isOverPace,
    dailyBudgetRemaining,
    statusText,
  };
}
