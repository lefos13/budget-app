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
}

export interface MonthProjectionInput {
  monthKey: string;
  monthlyBudget: number;
  spent: number;
  bills: ProjectionBillInput[];
  planned: ProjectionPlannedInput[];
}

export interface MonthProjection {
  budget: number;
  spent: number;
  plannedPending: number;
  billsDue: number;
  subscriptionsDue: number;
  carryOver: number;
  carryOverBills: number;
  carryOverSubscriptions: number;
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
 * projectedRemaining = B − spent − plannedPending − billsDue − subscriptionsDue − carryOver
 * committedTotal = plannedPending + billsDue + subscriptionsDue + carryOver
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
        plannedPending += item.amount;
      }
    }
  }

  let billsDue = 0;
  let subscriptionsDue = 0;
  let carryOverBills = 0;
  let carryOverSubscriptions = 0;

  for (const bill of input.bills ?? []) {
    const dueMs = toTime(bill.dueDate);
    if (dueMs === null || dueMs > endMs) {
      continue;
    }

    if (bill.type === 'SUBSCRIPTION') {
      if (dueMs >= startMs && dueMs <= endMs) {
        subscriptionsDue += bill.amount;
      } else if (dueMs < startMs) {
        const paidAtMs = toTime(bill.paidAt);
        const isUnpaidAsOfE = bill.status !== 'PAID' || (paidAtMs !== null && paidAtMs > endMs);
        if (isUnpaidAsOfE) {
          carryOverSubscriptions += bill.amount;
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
  const rPlannedPending = round2(plannedPending);
  const rBillsDue = round2(billsDue);
  const rSubscriptionsDue = round2(subscriptionsDue);
  const rCarryOverBills = round2(carryOverBills);
  const rCarryOverSubscriptions = round2(carryOverSubscriptions);
  const carryOver = round2(rCarryOverBills + rCarryOverSubscriptions);
  const committedTotal = round2(rPlannedPending + rBillsDue + rSubscriptionsDue + carryOver);
  let projectedRemaining = round2(budget - spent - committedTotal);
  if (projectedRemaining === 0) {
    projectedRemaining = 0;
  }
  const isOverBudget = projectedRemaining < 0;
  const overBy = isOverBudget ? round2(-projectedRemaining) : 0;

  return {
    budget,
    spent,
    plannedPending: rPlannedPending,
    billsDue: rBillsDue,
    subscriptionsDue: rSubscriptionsDue,
    carryOver,
    carryOverBills: rCarryOverBills,
    carryOverSubscriptions: rCarryOverSubscriptions,
    committedTotal,
    projectedRemaining,
    isOverBudget,
    overBy,
  };
}
