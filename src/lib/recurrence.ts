/**
 * Recurrence utilities for Aura Budget invoices and bills.
 * Pure date calculations operating strictly in UTC to remain independent of process timezone.
 */

export function addRecurrenceInterval(date: Date, interval: string): Date | null {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }

  if (typeof interval !== 'string') {
    return null;
  }

  const normalized = interval.trim().toUpperCase();

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  if (normalized === 'WEEKLY') {
    return new Date(Date.UTC(year, month, day + 7, hours, minutes, seconds, ms));
  }

  let monthsToAdd: number;
  if (normalized === 'MONTHLY') {
    monthsToAdd = 1;
  } else if (normalized === 'QUARTERLY') {
    monthsToAdd = 3;
  } else if (normalized === 'YEARLY') {
    monthsToAdd = 12;
  } else {
    return null;
  }

  const totalMonth = month + monthsToAdd;
  const targetYear = year + Math.floor(totalMonth / 12);
  const targetMonth = ((totalMonth % 12) + 12) % 12;

  // Day 0 of the following month in UTC yields the last day of targetMonth
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms));
}

export interface RecurringOccurrence {
  seriesId: string;
  type?: string | null;
  status: string;
  dueDate: Date | string;
  amount: number;
  isRecurring?: boolean;
  recurrenceInterval?: string | null;
}

export function isRecurringInvoice(inv: Pick<RecurringOccurrence, 'type' | 'isRecurring' | 'recurrenceInterval'>): boolean {
  return inv.type === 'SUBSCRIPTION' || Boolean(inv.isRecurring && inv.recurrenceInterval && inv.recurrenceInterval !== 'NONE');
}

/** Monthly-normalised cost of one occurrence of a recurring series. */
export function monthlyEquivalent(amount: number, interval: string | null | undefined): number {
  switch (interval) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'QUARTERLY':
      return amount / 3;
    case 'YEARLY':
      return amount / 12;
    default:
      return amount;
  }
}

/** Groups rows by `seriesId`; each series' rows are sorted by due date ascending. */
function groupSeries<T extends RecurringOccurrence>(invoices: T[]): T[][] {
  const series = new Map<string, T[]>();
  for (const inv of invoices) {
    const rows = series.get(inv.seriesId);
    if (rows) rows.push(inv);
    else series.set(inv.seriesId, [inv]);
  }
  const groups = [...series.values()];
  for (const rows of groups) rows.sort((a, b) => dueMs(a) - dueMs(b));
  return groups;
}

function dueMs(inv: Pick<RecurringOccurrence, 'dueDate'>): number {
  return new Date(inv.dueDate).getTime();
}

/** Earliest unpaid row of a date-sorted, non-empty series, else its latest row. */
function pickNextFromSeries<T extends RecurringOccurrence>(rows: T[]): T {
  return rows.find((r) => r.status !== 'PAID') ?? rows[rows.length - 1];
}

/**
 * Month-independent catalogue view (`/recurring`): collapses each recurring series (shared `seriesId`) to its
 * next relevant occurrence — the earliest unpaid one (PENDING or OVERDUE), else the latest. Ordered by due date.
 */
export function pickNextOccurrences<T extends RecurringOccurrence>(invoices: T[]): T[] {
  return groupSeries(invoices)
    .map(pickNextFromSeries)
    .sort((a, b) => dueMs(a) - dueMs(b));
}

/**
 * Paying a recurring invoice rolls it forward into a new row, so one series (shared `seriesId`) is stored as
 * many rows. Collapses each series to the single occurrence relevant for the [monthStart, monthEnd] window:
 * the earliest unpaid occurrence due in the window, else the last one due in the window, else the earliest
 * unpaid occurrence overall, else the latest occurrence. Result is ordered by due date.
 */
export function pickSeriesOccurrences<T extends RecurringOccurrence>(invoices: T[], monthStart: Date, monthEnd: Date): T[] {
  const startMs = monthStart.getTime();
  const endMs = monthEnd.getTime();
  return groupSeries(invoices)
    .map((rows) => {
      const inMonth = rows.filter((r) => dueMs(r) >= startMs && dueMs(r) <= endMs);
      return pickNextFromSeries(inMonth.length > 0 ? inMonth : rows);
    })
    .sort((a, b) => dueMs(a) - dueMs(b));
}
