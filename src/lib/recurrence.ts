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
