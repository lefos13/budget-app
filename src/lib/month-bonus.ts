/**
 * Month bonus math. Pure TypeScript, no React, no Prisma.
 * A bonus is outside money added to ONE month's budget; the wallet's monthly target is never changed.
 */

export interface MonthBonusLike {
  monthKey: string;
  amount: number;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Sum of the bonuses dated to `monthKey` (other months are ignored). */
export function sumBonusForMonth(bonuses: MonthBonusLike[], monthKey: string): number {
  return round2(bonuses.reduce((sum, b) => (b.monthKey === monthKey ? sum + b.amount : sum), 0));
}

/** Budget available in a month: baseline target + General savings boost + month bonuses. */
export function effectiveBudget(parts: { monthlyBudget: number; boost?: number; bonus?: number }): number {
  return round2((parts.monthlyBudget ?? 0) + (parts.boost ?? 0) + (parts.bonus ?? 0));
}
