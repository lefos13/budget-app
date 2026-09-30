/**
 * Month utility helpers.
 * Pure TypeScript, no React, no Prisma.
 * All computations are in LOCAL time, consistent with server code.
 */

export type MonthKey = string; // 'YYYY-MM'

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Strictly parses a MonthKey ('YYYY-MM').
 * Returns { year, monthIndex (0-11) } or null if invalid.
 */
export function parseMonthKey(key: string): { year: number; monthIndex: number } | null {
  if (typeof key !== 'string' || !MONTH_KEY_REGEX.test(key)) {
    return null;
  }
  const [yearStr, monthStr] = key.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  return { year, monthIndex };
}

/**
 * Validates whether an unknown value is a valid MonthKey ('YYYY-MM').
 */
export function isValidMonthKey(key: unknown): key is MonthKey {
  return typeof key === 'string' && MONTH_KEY_REGEX.test(key);
}

/**
 * Formats a year and monthIndex (0-indexed) into a MonthKey.
 * Handles monthIndex overflow/underflow, e.g.:
 * (2026, 12) -> '2027-01'
 * (2026, -1) -> '2025-12'
 */
export function formatMonthKey(year: number, monthIndex: number): MonthKey {
  const totalMonths = year * 12 + monthIndex;
  const y = Math.floor(totalMonths / 12);
  const m = ((totalMonths % 12) + 12) % 12 + 1;
  const yStr = y >= 0 ? String(y).padStart(4, '0') : String(y);
  return `${yStr}-${String(m).padStart(2, '0')}`;
}

/**
 * Returns the MonthKey for a given Date in local time.
 */
export function getMonthKey(date: Date): MonthKey {
  return formatMonthKey(date.getFullYear(), date.getMonth());
}

/**
 * Returns the MonthKey for current local month (or relative to passed `now`).
 */
export function getCurrentMonthKey(now: Date = new Date()): MonthKey {
  return getMonthKey(now);
}

/**
 * Adds delta months to a MonthKey.
 * Handles Dec -> Jan year rollover in both directions.
 * Returns current month key if the given key is invalid.
 */
export function addMonthsToKey(key: MonthKey, delta: number): MonthKey {
  const parsed = parseMonthKey(key);
  if (!parsed) {
    return getCurrentMonthKey();
  }
  return formatMonthKey(parsed.year, parsed.monthIndex + delta);
}

/**
 * Returns the local time start and end Date bounds for a month.
 * start: local 1st day 00:00:00.000
 * end: local last day 23:59:59.999 (leap February handled)
 * Invalid key falls back to bounds of the current month.
 */
export function getMonthBounds(key: MonthKey): { start: Date; end: Date } {
  let parsed = parseMonthKey(key);
  if (!parsed) {
    parsed = parseMonthKey(getCurrentMonthKey())!;
  }
  const start = new Date(parsed.year, parsed.monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(parsed.year, parsed.monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Formats a Date as local 'YYYY-MM-DD'.
 * Avoids toISOString() which shifts days in timezones east of UTC.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks whether a MonthKey represents the current month.
 */
export function isCurrentMonthKey(key: MonthKey, now: Date = new Date()): boolean {
  return key === getCurrentMonthKey(now);
}

/**
 * Compares two MonthKeys.
 * Returns negative if a < b, 0 if a === b, positive if a > b.
 */
export function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  const parsedA = parseMonthKey(a);
  const parsedB = parseMonthKey(b);
  if (parsedA && parsedB) {
    const valA = parsedA.year * 12 + parsedA.monthIndex;
    const valB = parsedB.year * 12 + parsedB.monthIndex;
    return valA < valB ? -1 : valA > valB ? 1 : 0;
  }
  return a.localeCompare(b);
}

/**
 * Returns the pacing reference Date for a month:
 * - current month: `now`
 * - past month: `end` of that month (local last day 23:59:59.999)
 * - future month: `start` of that month (local 1st day 00:00:00.000)
 */
export function getPacingReferenceDate(key: MonthKey, now: Date = new Date()): Date {
  if (!isValidMonthKey(key) || isCurrentMonthKey(key, now)) {
    return now;
  }
  const currentKey = getCurrentMonthKey(now);
  const cmp = compareMonthKeys(key, currentKey);
  const bounds = getMonthBounds(key);
  if (cmp < 0) {
    return bounds.end;
  }
  return bounds.start;
}
