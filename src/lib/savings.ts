/**
 * Savings buckets: contribution / allocation math.
 * Pure TypeScript, no React, no Prisma. Month attribution is LOCAL time, like `month.ts`.
 *
 * Ledger sign convention (amount is signed, balance = Σ amount):
 *   DEPOSIT      +  money from the month's budget into a bucket (counts against the budget)
 *   TRANSFER_IN  +  money moved in from another bucket (budget-neutral)
 *   TRANSFER_OUT −  money moved out to another bucket (budget-neutral)
 *   EXPENSE_DRAW −  money used to pay a linked planned expense (budget-neutral)
 *   BUDGET_BOOST −  General money used as extra budget for a month (GENERAL only)
 *   ADJUSTMENT_IN  +  money recorded into General from outside the app (GENERAL only, budget-neutral)
 *   ADJUSTMENT_OUT −  money taken out of General to outside the app (GENERAL only, budget-neutral)
 * Adjustments never count as budget use nor towards a bucket's monthly contribution.
 */
import {
  MonthKey,
  compareMonthKeys,
  getCurrentMonthKey,
  getMonthBounds,
  getMonthKey,
  parseMonthKey,
  addMonthsToKey,
} from './month';

export const SAVINGS_TX_TYPES = [
  'DEPOSIT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'EXPENSE_DRAW',
  'BUDGET_BOOST',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
] as const;
export type SavingsTxType = (typeof SAVINGS_TX_TYPES)[number];

export interface SavingsLedgerEntry {
  type: string;
  amount: number;
  date: Date | string;
}

export interface SavingsPlannedInput {
  id: string;
  amount: number;
  expectedDate: Date | string;
  createdAt?: Date | string | null;
  trackFromMonth?: string | null;
}

export interface SavingsBucketInput {
  id: string;
  kind: string; // 'GENERAL' | 'GOAL'
  ledger: SavingsLedgerEntry[];
  /** PENDING planned expenses currently linked to the bucket. */
  pending: SavingsPlannedInput[];
}

export interface ExpenseAllocation {
  id: string;
  amount: number;
  expectedDate: Date;
  monthsLeft: number;
  allocated: number;
  remaining: number;
  /** Monthly contribution this expense needs in the evaluated month (0 when monthsLeft ≤ 0 or tracking not yet active). */
  contribution: number;
  trackFromMonth?: string | null;
  isTrackingActive: boolean;
}

export interface BucketMonth {
  bucketId: string;
  kind: string;
  /** Balance at the start of the month (actual for current/past months, simulated for future months). */
  balanceStart: number;
  /** Actual balance today (all ledger entries). */
  balanceNow: number;
  target: number;
  /** Allocation of `balanceStart` to pending expenses (earliest first). */
  allocations: ExpenseAllocation[];
  /** Contribution required in the month, computed from `balanceStart`. */
  contributionDue: number;
  /** Net inflow in the month from deposits and transfers (what satisfies the contribution). */
  contributed: number;
  /** Still to deposit this month: max(0, contributionDue − contributed). */
  savingsDue: number;
  /** DEPOSIT total in the month (budget effect). */
  deposited: number;
  /** BUDGET_BOOST total in the month, positive (GENERAL only). */
  boost: number;
}

export interface SavingsMonth {
  buckets: BucketMonth[];
  deposited: number;
  boost: number;
  savingsDue: number;
  /** For pending expenses due in the evaluated month: the part covered by savings. */
  fundedByPlannedId: Record<string, number>;
}

const EPS = 1e-9;
export const round2 = (x: number): number => {
  const r = Math.round((x + (x >= 0 ? EPS : -EPS)) * 100) / 100;
  return r === 0 ? 0 : r;
};
/** Rounds up to the cent so following the schedule never falls short by rounding. */
export const ceil2 = (x: number): number => {
  if (x <= 0) return 0;
  return Math.ceil(x * 100 - 1e-6) / 100;
};

function toDate(val: Date | string | null | undefined): Date | null {
  if (val === null || val === undefined || val === '') return null;
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthIndex(key: MonthKey): number {
  const parsed = parseMonthKey(key);
  if (!parsed) throw new Error(`Invalid month key: ${key}`);
  return parsed.year * 12 + parsed.monthIndex;
}

/**
 * Number of monthly contributions left before an expense is due:
 * contributions happen in months M … E−1, so an expense due in month E evaluated in month M has E − M.
 * ≤ 0 in the due month or later.
 */
export function monthsLeft(monthKey: MonthKey, expectedDate: Date | string): number {
  const d = toDate(expectedDate);
  if (!d) return 0;
  return monthIndex(getMonthKey(d)) - monthIndex(monthKey);
}

/** Only planned expenses dated in a future month can be linked to a savings bucket. */
export function canLinkToSavings(expectedDate: Date | string, now: Date = new Date()): boolean {
  const d = toDate(expectedDate);
  if (!d) return false;
  return compareMonthKeys(getMonthKey(d), getCurrentMonthKey(now)) > 0;
}

/** Sum of ledger amounts, optionally only entries strictly before `before`. */
export function bucketBalance(ledger: SavingsLedgerEntry[], before?: Date): number {
  const limit = before ? before.getTime() : null;
  let sum = 0;
  for (const entry of ledger) {
    if (limit !== null) {
      const d = toDate(entry.date);
      if (!d || d.getTime() >= limit) continue;
    }
    sum += entry.amount;
  }
  return round2(sum);
}

function sumInMonth(
  ledger: SavingsLedgerEntry[],
  monthKey: MonthKey,
  types: readonly string[]
): number {
  const { start, end } = getMonthBounds(monthKey);
  const s = start.getTime();
  const e = end.getTime();
  let sum = 0;
  for (const entry of ledger) {
    if (!types.includes(entry.type)) continue;
    const d = toDate(entry.date);
    if (!d) continue;
    const t = d.getTime();
    if (t >= s && t <= e) sum += entry.amount;
  }
  return round2(sum);
}

/** DEPOSIT total dated in the month (the budget effect of saving). */
export function depositedInMonth(ledger: SavingsLedgerEntry[], monthKey: MonthKey): number {
  return sumInMonth(ledger, monthKey, ['DEPOSIT']);
}

/** Net deposits + transfers dated in the month (what counts towards the month's contribution). */
export function contributedInMonth(ledger: SavingsLedgerEntry[], monthKey: MonthKey): number {
  return sumInMonth(ledger, monthKey, ['DEPOSIT', 'TRANSFER_IN', 'TRANSFER_OUT']);
}

/** BUDGET_BOOST total dated in the month, returned as a positive number. */
export function boostInMonth(ledger: SavingsLedgerEntry[], monthKey: MonthKey): number {
  return round2(-sumInMonth(ledger, monthKey, ['BUDGET_BOOST']));
}

function sortPending(pending: SavingsPlannedInput[]): Array<SavingsPlannedInput & { date: Date }> {
  return pending
    .map((p) => ({ ...p, date: toDate(p.expectedDate) }))
    .filter((p): p is SavingsPlannedInput & { date: Date } => p.date !== null && p.amount > 0)
    .sort((a, b) => {
      const byDate = a.date.getTime() - b.date.getTime();
      if (byDate !== 0) return byDate;
      const ca = toDate(a.createdAt ?? null)?.getTime() ?? 0;
      const cb = toDate(b.createdAt ?? null)?.getTime() ?? 0;
      if (ca !== cb) return ca - cb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/**
 * Allocates a balance to pending expenses, earliest expected date first, and computes each expense's
 * contribution for `monthKey`: (amount − allocated) ÷ monthsLeft, rounded up to the cent.
 */
export function allocate(
  balance: number,
  pending: SavingsPlannedInput[],
  monthKey: MonthKey
): ExpenseAllocation[] {
  let left = Math.max(0, balance);
  return sortPending(pending).map((p) => {
    const allocated = round2(Math.min(left, p.amount));
    left = round2(left - allocated);
    const remaining = round2(p.amount - allocated);
    const ml = monthsLeft(monthKey, p.date);
    const isTrackingActive = !p.trackFromMonth || compareMonthKeys(monthKey, p.trackFromMonth) >= 0;
    return {
      id: p.id,
      amount: round2(p.amount),
      expectedDate: p.date,
      monthsLeft: ml,
      allocated,
      remaining,
      contribution: isTrackingActive && ml >= 1 ? ceil2(remaining / ml) : 0,
      trackFromMonth: p.trackFromMonth ?? null,
      isTrackingActive,
    };
  });
}

function totalContribution(allocs: ExpenseAllocation[]): number {
  return round2(allocs.reduce((sum, a) => sum + a.contribution, 0));
}

/**
 * Simulates the bucket from the current month up to the start of `targetKey`, assuming every scheduled
 * contribution is deposited and every expense is paid (drawn) in its due month.
 */
function simulateFuture(
  bucket: SavingsBucketInput,
  currentKey: MonthKey,
  targetKey: MonthKey
): { balanceStart: number; pending: SavingsPlannedInput[] } {
  const { start: currentStart } = getMonthBounds(currentKey);
  const startCurrent = bucketBalance(bucket.ledger, currentStart);
  let balance = bucketBalance(bucket.ledger);
  let pending = sortPending(bucket.pending);

  const dueCurrent = totalContribution(allocate(startCurrent, pending, currentKey));
  balance = round2(balance + Math.max(0, dueCurrent - contributedInMonth(bucket.ledger, currentKey)));

  let key = currentKey;
  while (compareMonthKeys(key, targetKey) < 0) {
    // Expenses due in `key` (or overdue) are paid during `key`.
    const stillPending: typeof pending = [];
    for (const p of pending) {
      if (compareMonthKeys(getMonthKey(p.date), key) <= 0) {
        balance = round2(balance - Math.min(Math.max(0, balance), p.amount));
      } else {
        stillPending.push(p);
      }
    }
    pending = stillPending;
    key = addMonthsToKey(key, 1);
    if (compareMonthKeys(key, targetKey) >= 0) break;
    balance = round2(balance + totalContribution(allocate(balance, pending, key)));
  }
  return { balanceStart: balance, pending };
}

/** Computes one bucket's figures for a month. `now` decides which months are actual vs simulated. */
export function computeBucketMonth(
  bucket: SavingsBucketInput,
  monthKey: MonthKey,
  now: Date = new Date()
): BucketMonth {
  const currentKey = getCurrentMonthKey(now);
  const isFuture = compareMonthKeys(monthKey, currentKey) > 0;
  const balanceNow = bucketBalance(bucket.ledger);

  let balanceStart: number;
  let pending: SavingsPlannedInput[];
  if (isFuture) {
    ({ balanceStart, pending } = simulateFuture(bucket, currentKey, monthKey));
  } else {
    balanceStart = bucketBalance(bucket.ledger, getMonthBounds(monthKey).start);
    pending = bucket.pending;
  }

  const isGoal = bucket.kind !== 'GENERAL';
  const allocations = isGoal ? allocate(balanceStart, pending, monthKey) : [];
  const contributionDue = totalContribution(allocations);
  const contributed = isFuture ? 0 : contributedInMonth(bucket.ledger, monthKey);
  const deposited = isFuture ? 0 : depositedInMonth(bucket.ledger, monthKey);
  const boost = isFuture ? 0 : boostInMonth(bucket.ledger, monthKey);

  return {
    bucketId: bucket.id,
    kind: bucket.kind,
    balanceStart,
    balanceNow,
    target: round2(sortPending(bucket.pending).reduce((sum, p) => sum + p.amount, 0)),
    allocations,
    contributionDue,
    contributed,
    // Only buckets still saving for something have a due amount (closed buckets have no pending expenses).
    savingsDue: isGoal && allocations.length > 0 ? round2(Math.max(0, contributionDue - contributed)) : 0,
    deposited,
    boost,
  };
}

/**
 * Wallet-level savings figures for a month: budget effect (`deposited`, `boost`), what is still to be
 * deposited (`savingsDue`), and how much of each pending expense due in the month savings already cover.
 */
export function computeSavingsMonth(
  buckets: SavingsBucketInput[],
  monthKey: MonthKey,
  now: Date = new Date()
): SavingsMonth {
  const results = buckets.map((b) => computeBucketMonth(b, monthKey, now));
  const fundedByPlannedId: Record<string, number> = {};
  const currentKey = getCurrentMonthKey(now);
  const isFuture = compareMonthKeys(monthKey, currentKey) > 0;

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    if (bucket.kind === 'GENERAL') continue;
    // Funding of expenses due in the month uses the balance available during that month:
    // today's balance for current/past months, the simulated start balance for future months.
    const available = isFuture ? results[i].balanceStart : results[i].balanceNow;
    const pending = isFuture
      ? results[i].allocations.map((a) => ({ id: a.id, amount: a.amount, expectedDate: a.expectedDate }))
      : bucket.pending;
    for (const a of allocate(available, pending, monthKey)) {
      if (getMonthKey(a.expectedDate) === monthKey) {
        fundedByPlannedId[a.id] = a.allocated;
      }
    }
  }

  return {
    buckets: results,
    deposited: round2(results.reduce((s, r) => s + r.deposited, 0)),
    boost: round2(results.reduce((s, r) => s + r.boost, 0)),
    savingsDue: round2(results.reduce((s, r) => s + r.savingsDue, 0)),
    fundedByPlannedId,
  };
}
