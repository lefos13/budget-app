import { getMonthBounds } from './month';

export interface ProjectionBillInput {
  type: string;
  amount: number;
  dueDate: Date | string;
  status: string;
  paidAt: Date | string | null;
  linkedExpenseDate: Date | string | null;
}

export interface ProjectionPlannedInput {
  amount: number;
  expectedDate: Date | string;
  status: string;
  /** Part of a pending expense already covered by its savings bucket (only that remainder is committed). */
  fundedAmount?: number;
}

export interface ProjectionSavingsInput {
  /** DEPOSIT total in the month: money moved from the budget into savings. */
  deposited: number;
  /** Contribution still to deposit this month. */
  savingsDue: number;
  /** General money explicitly used as extra budget this month. */
  boost: number;
}

export interface MonthProjectionInput {
  monthKey: string;
  monthlyBudget: number;
  spent: number;
  bills: ProjectionBillInput[];
  planned: ProjectionPlannedInput[];
  savings?: ProjectionSavingsInput;
  /** Month bonuses (outside money added to this month's budget). */
  bonus?: number;
}

export interface MonthProjection {
  budget: number;
  spent: number;
  savingsDeposited: number;
  savingsDue: number;
  boost: number;
  bonus: number;
  plannedPending: number;
  billsDue: number;
  subscriptionsDue: number;
  /** Subscriptions paid as of month end (they never create expenses, so they are counted here). */
  subscriptionsPaid: number;
  carryOver: number;
  carryOverBills: number;
  carryOverSubscriptions: number;
  /** Budget already used: spent + savingsDeposited + subscriptionsPaid. */
  used: number;
  /** Budget left before anything still due: budget + boost + bonus − used. */
  remaining: number;
  committedTotal: number;
  projectedRemaining: number;
  isOverBudget: boolean;
  overBy: number;
}

function toTime(val: Date | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const d = val instanceof Date ? val : new Date(val);
  const time = d.getTime();
  return Number.isNaN(time) ? null : time;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Computes projected remaining budget for a given month key.
 *
 * used = spent + savingsDeposited + subscriptionsPaid
 * remaining = B + boost + bonus − used
 * committedTotal = plannedPending + savingsDue + billsDue + subscriptionsDue + carryOver
 * projectedRemaining = remaining − committedTotal (the month's "free to spend")
 * overBy = Math.max(0, -projectedRemaining)
 */
export function computeMonthProjection(input: MonthProjectionInput): MonthProjection {
  const { start, end } = getMonthBounds(input.monthKey);
  const startMs = start.getTime();
  const endMs = end.getTime();

  let plannedPending = 0;
  for (const item of input.planned ?? []) {
    if (item.status === 'PENDING') {
      const expMs = toTime(item.expectedDate);
      if (expMs !== null && expMs >= startMs && expMs <= endMs) {
        plannedPending += Math.max(0, item.amount - (item.fundedAmount ?? 0));
      }
    }
  }

  let billsDue = 0;
  let subscriptionsDue = 0;
  let subscriptionsPaid = 0;
  let carryOverBills = 0;
  let carryOverSubscriptions = 0;

  for (const bill of input.bills ?? []) {
    const dueMs = toTime(bill.dueDate);
    if (dueMs === null || dueMs > endMs) {
      continue;
    }

    if (bill.type === 'SUBSCRIPTION') {
      const paidAtMs = toTime(bill.paidAt);
      const isUnpaidAsOfE = bill.status !== 'PAID' || (paidAtMs !== null && paidAtMs > endMs);
      if (dueMs >= startMs && dueMs <= endMs) {
        if (isUnpaidAsOfE) {
          subscriptionsDue += bill.amount;
        } else {
          subscriptionsPaid += bill.amount;
        }
      } else if (dueMs < startMs) {
        if (isUnpaidAsOfE) {
          carryOverSubscriptions += bill.amount;
        } else if (paidAtMs !== null && paidAtMs >= startMs) {
          // Paid late: it uses the budget of the month it was paid in
          subscriptionsPaid += bill.amount;
        }
      }
    } else {
      // One-off bill (type !== 'SUBSCRIPTION')
      const linkedExpenseMs = toTime(bill.linkedExpenseDate);
      let isPaidAsOfE = false;

      if (linkedExpenseMs !== null) {
        isPaidAsOfE = linkedExpenseMs <= endMs;
      } else {
        if (bill.status === 'PAID') {
          const paidAtMs = toTime(bill.paidAt);
          isPaidAsOfE = paidAtMs === null || paidAtMs <= endMs;
        } else {
          isPaidAsOfE = false;
        }
      }

      if (!isPaidAsOfE) {
        if (dueMs >= startMs && dueMs <= endMs) {
          billsDue += bill.amount;
        } else if (dueMs < startMs) {
          carryOverBills += bill.amount;
        }
      }
    }
  }

  const budget = round2(input.monthlyBudget ?? 0);
  const spent = round2(input.spent ?? 0);
  const savingsDeposited = round2(input.savings?.deposited ?? 0);
  const savingsDue = round2(input.savings?.savingsDue ?? 0);
  const boost = round2(input.savings?.boost ?? 0);
  const bonus = round2(input.bonus ?? 0);
  const rPlannedPending = round2(plannedPending);
  const rBillsDue = round2(billsDue);
  const rSubscriptionsDue = round2(subscriptionsDue);
  const rSubscriptionsPaid = round2(subscriptionsPaid);
  const rCarryOverBills = round2(carryOverBills);
  const rCarryOverSubscriptions = round2(carryOverSubscriptions);
  const carryOver = round2(rCarryOverBills + rCarryOverSubscriptions);
  const committedTotal = round2(rPlannedPending + savingsDue + rBillsDue + rSubscriptionsDue + carryOver);
  const used = round2(spent + savingsDeposited + rSubscriptionsPaid);
  const remaining = round2(budget + boost + bonus - used);
  let projectedRemaining = round2(remaining - committedTotal);
  if (projectedRemaining === 0) {
    projectedRemaining = 0;
  }
  const isOverBudget = projectedRemaining < 0;
  const overBy = isOverBudget ? round2(-projectedRemaining) : 0;

  return {
    budget,
    spent,
    savingsDeposited,
    savingsDue,
    boost,
    bonus,
    plannedPending: rPlannedPending,
    billsDue: rBillsDue,
    subscriptionsDue: rSubscriptionsDue,
    subscriptionsPaid: rSubscriptionsPaid,
    carryOver,
    carryOverBills: rCarryOverBills,
    carryOverSubscriptions: rCarryOverSubscriptions,
    used,
    remaining,
    committedTotal,
    projectedRemaining,
    isOverBudget,
    overBy,
  };
}
