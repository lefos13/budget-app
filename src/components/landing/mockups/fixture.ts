export type MockRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export interface MockCategory {
  id: string;
  labelKey: 'catGroceries' | 'catTransport' | 'catDining' | 'catHome';
  amount: number;
  /** Tailwind background class for the bar. */
  barClass: string;
}

export interface MockBill {
  id: string;
  labelKey: 'billStreaming' | 'billElectricity' | 'billInternet';
  type: 'BILL' | 'SUBSCRIPTION';
  amount: number;
  /** Day of the current month. */
  day: number;
}

export interface MockBucket {
  id: string;
  labelKey: 'general' | 'goalSummerTrip';
  balance: number;
  target: number | null;
}

export interface MockMember {
  id: string;
  initials: string;
  role: MockRole;
}

export interface MockExpense {
  id: string;
  categoryKey: MockCategory['labelKey'];
  amount: number;
  day: number;
}

export const mockWallet = {
  currency: 'EUR',
  monthlyBudget: 2400,
  spent: 1310,
  saved: 250,
  categories: [
    { id: 'c1', labelKey: 'catGroceries', amount: 420, barClass: 'bg-emerald-500' },
    { id: 'c2', labelKey: 'catHome', amount: 380, barClass: 'bg-indigo-500' },
    { id: 'c3', labelKey: 'catDining', amount: 290, barClass: 'bg-amber-500' },
    { id: 'c4', labelKey: 'catTransport', amount: 220, barClass: 'bg-sky-500' },
  ] as MockCategory[],
  bills: [
    { id: 'b1', labelKey: 'billStreaming', type: 'SUBSCRIPTION', amount: 12.99, day: 24 },
    { id: 'b2', labelKey: 'billElectricity', type: 'BILL', amount: 84.5, day: 26 },
    { id: 'b3', labelKey: 'billInternet', type: 'BILL', amount: 29.9, day: 28 },
  ] as MockBill[],
  buckets: [
    { id: 's1', labelKey: 'general', balance: 100, target: null },
    { id: 's2', labelKey: 'goalSummerTrip', balance: 150, target: 600 },
  ] as MockBucket[],
  members: [
    { id: 'm1', initials: 'AJ', role: 'OWNER' },
    { id: 'm2', initials: 'JS', role: 'MEMBER' },
    { id: 'm3', initials: 'MK', role: 'VIEWER' },
  ] as MockMember[],
  recentExpenses: [
    { id: 'e1', categoryKey: 'catGroceries', amount: 42.3, day: 2 },
    { id: 'e2', categoryKey: 'catDining', amount: 28, day: 2 },
    { id: 'e3', categoryKey: 'catTransport', amount: 15.5, day: 1 },
  ] as MockExpense[],
};

export type MockWallet = typeof mockWallet;

/** Build an ISO date (yyyy-MM-dd) in the month of `now`. */
export function mockDateISO(day: number, now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${String(day).padStart(2, '0')}`;
}
