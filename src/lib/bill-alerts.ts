import { parseISO } from 'date-fns';
import { getMonthBounds } from './month';

export interface BaseAlertInvoice {
  id: string;
  title: string;
  amount: number;
  dueDate: string | Date;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | string;
  type?: 'BILL' | 'SUBSCRIPTION' | string;
  category?: { id: string; name: string; color: string; icon: string } | null;
}

/**
 * Normalises a date or ISO string to a Date object.
 */
export function normalizeDate(date: Date | string): Date {
  return typeof date === 'string' ? parseISO(date) : date;
}

/**
 * Calculates day difference between due date and reference date (both normalized to local midnight).
 * Negative means overdue, 0 means today, positive means in future.
 * Uses Math.round to safely absorb daylight saving transitions (23h / 25h days).
 */
export function getDueDayDifference(dueDate: Date | string, referenceDate: Date = new Date()): number {
  const d = normalizeDate(dueDate);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffMs = dDay.getTime() - nowDay.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * An invoice is overdue if its status is OVERDUE or its due date is before today (and not PAID).
 */
export function isInvoiceOverdue(
  dueDate: Date | string,
  referenceDate: Date = new Date()
): boolean {
  return getDueDayDifference(dueDate, referenceDate) < 0;
}

/**
 * An invoice is imminent if it is due in 0 to 3 days (today, tomorrow, in 2 or 3 days).
 */
export function isInvoiceImminent(
  dueDate: Date | string,
  referenceDate: Date = new Date()
): boolean {
  const diff = getDueDayDifference(dueDate, referenceDate);
  return diff >= 0 && diff <= 3;
}

/**
 * An invoice is urgent if it is overdue or imminent (due in <= 3 days).
 */
export function isInvoiceUrgent(
  dueDate: Date | string,
  referenceDate: Date = new Date()
): boolean {
  return getDueDayDifference(dueDate, referenceDate) <= 3;
}

/**
 * Checks whether an item is overdue (considers status and due date).
 */
export function isOverdueItem(
  inv: { dueDate: Date | string; status: string },
  referenceDate: Date = new Date()
): boolean {
  if (inv.status === 'PAID') return false;
  return inv.status === 'OVERDUE' || isInvoiceOverdue(inv.dueDate, referenceDate);
}

/**
 * Returns urgent bills and subscriptions (due in <= 3 days or overdue), sorted by due date ascending.
 * Excludes already paid invoices.
 */
export function getUrgentBills<T extends BaseAlertInvoice>(
  invoices: T[],
  referenceDate: Date = new Date()
): T[] {
  return invoices
    .filter((inv) => {
      if (inv.status === 'PAID') return false;
      return isInvoiceUrgent(inv.dueDate, referenceDate) || inv.status === 'OVERDUE';
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export interface UnpaidMonthResult<T extends BaseAlertInvoice> {
  monthItems: T[];
  carryOverItems: T[];
  monthTotal: number;
  carryOverTotal: number;
}

/**
 * Returns unpaid bills & subscriptions for a given month key, separated into:
 * - monthItems: due within the selected month
 * - carryOverItems: due before the selected month (carried over)
 * Excludes already paid invoices.
 */
export function getUnpaidForMonth<T extends BaseAlertInvoice>(
  invoices: T[],
  monthKey: string
): UnpaidMonthResult<T> {
  const { start: monthStart, end: monthEnd } = getMonthBounds(monthKey);

  const monthItems = invoices
    .filter((inv) => {
      if (inv.status === 'PAID') return false;
      const due = normalizeDate(inv.dueDate);
      return due >= monthStart && due <= monthEnd;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const carryOverItems = invoices
    .filter((inv) => {
      if (inv.status === 'PAID') return false;
      const due = normalizeDate(inv.dueDate);
      return due < monthStart;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const monthTotal = monthItems.reduce((acc, item) => acc + item.amount, 0);
  const carryOverTotal = carryOverItems.reduce((acc, item) => acc + item.amount, 0);

  return {
    monthItems,
    carryOverItems,
    monthTotal: Math.round(monthTotal * 100) / 100,
    carryOverTotal: Math.round(carryOverTotal * 100) / 100,
  };
}

export interface AlertSummary<T extends BaseAlertInvoice> {
  urgentBills: T[];
  monthItems: T[];
  carryOverItems: T[];
  distinctCount: number;
  hasOverdue: boolean;
  overdueCount: number;
}

/**
 * Computes the unified alert summary across:
 * urgent ∪ selected-month unpaid ∪ carry-over
 * Badge count equals the distinct number of invoice IDs.
 */
export function getAlertSummary<T extends BaseAlertInvoice>(
  invoices: T[],
  monthKey: string,
  referenceDate: Date = new Date()
): AlertSummary<T> {
  const urgentBills = getUrgentBills(invoices, referenceDate);
  const { monthItems, carryOverItems } = getUnpaidForMonth(invoices, monthKey);

  const alertMap = new Map<string, T>();
  for (const item of urgentBills) {
    alertMap.set(item.id, item);
  }
  for (const item of monthItems) {
    alertMap.set(item.id, item);
  }
  for (const item of carryOverItems) {
    alertMap.set(item.id, item);
  }

  let overdueCount = 0;
  for (const item of alertMap.values()) {
    if (isOverdueItem(item, referenceDate)) {
      overdueCount++;
    }
  }

  return {
    urgentBills,
    monthItems,
    carryOverItems,
    distinctCount: alertMap.size,
    hasOverdue: overdueCount > 0,
    overdueCount,
  };
}

/**
 * Returns distinct alert count for the badge.
 */
export function getAlertCount<T extends BaseAlertInvoice>(
  invoices: T[],
  monthKey: string,
  referenceDate: Date = new Date()
): number {
  return getAlertSummary(invoices, monthKey, referenceDate).distinctCount;
}

/**
 * Returns whether any alert item in the set is overdue.
 */
export function hasOverdueAlerts<T extends BaseAlertInvoice>(
  invoices: T[],
  monthKey: string,
  referenceDate: Date = new Date()
): boolean {
  return getAlertSummary(invoices, monthKey, referenceDate).hasOverdue;
}

export interface AlertBadgeInfo {
  count: number;
  countLabel: string;
  hasOverdue: boolean;
  overdueCount: number;
  color: 'rose' | 'amber';
  isVisible: boolean;
}

/**
 * Pre-computed badge values for sidebar, mobile topbar, drawer and bottom nav.
 * Cap at 99+. Hidden at count 0. Red if any overdue, amber otherwise.
 */
export function getAlertBadgeInfo<T extends BaseAlertInvoice>(
  invoices: T[],
  monthKey: string,
  referenceDate: Date = new Date()
): AlertBadgeInfo {
  const summary = getAlertSummary(invoices, monthKey, referenceDate);
  return {
    count: summary.distinctCount,
    countLabel: summary.distinctCount > 99 ? '99+' : String(summary.distinctCount),
    hasOverdue: summary.hasOverdue,
    overdueCount: summary.overdueCount,
    color: summary.hasOverdue ? 'rose' : 'amber',
    isVisible: summary.distinctCount > 0,
  };
}
