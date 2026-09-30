'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';

export interface SavingsExpense {
  id: string;
  title: string;
  amount: number;
  expectedDate: string;
  categoryId: string | null;
  allocated: number;
  remaining: number;
  monthsLeft: number;
  contribution: number;
}

export interface SavingsBucketView {
  id: string;
  name: string;
  color: string;
  icon: string;
  status: string;
  balance: number;
  target: number;
  progress: number;
  contributionDue: number;
  contributed: number;
  savingsDue: number;
  deposited: number;
  nextDueDate: string | null;
  expenses: SavingsExpense[];
}

export interface SavingsOverview {
  month: string;
  general: {
    id: string;
    name: string;
    color: string;
    icon: string;
    balance: number;
    depositedThisMonth: number;
    boostThisMonth: number;
  } | null;
  buckets: SavingsBucketView[];
  closedBuckets: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    closedAt: string | null;
    expenses: Array<{ id: string; title: string; amount: number; status: string; expectedDate: string }>;
  }>;
  totals: { saved: number; savingsDue: number; deposited: number };
}

/** Savings overview for the active wallet and selected month; refetches whenever wallet data refreshes. */
export function useSavings() {
  const { activeWalletId, selectedMonth, currentUser, walletData } = useApp();
  const [data, setData] = useState<SavingsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const key = activeWalletId ? `${activeWalletId}:${selectedMonth}` : null;

  useEffect(() => {
    if (!activeWalletId) return;
    let cancelled = false;
    const requestKey = `${activeWalletId}:${selectedMonth}`;
    const fetchSavings = async () => {
      try {
        const res = await fetch(`/api/wallets/${activeWalletId}/savings?month=${selectedMonth}`, {
          headers: currentUser ? { 'x-user-id': currentUser.id } : {},
          credentials: 'include',
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof json?.error === 'string' ? json.error : 'Failed to fetch savings');
          return;
        }
        setData(json);
        setError(null);
        setLoadedKey(requestKey);
      } catch {
        if (!cancelled) setError('Failed to fetch savings');
      }
    };
    fetchSavings();
    return () => {
      cancelled = true;
    };
  }, [activeWalletId, selectedMonth, currentUser, walletData, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return {
    data: key && loadedKey === key ? data : null,
    staleData: data,
    error,
    isLoading: Boolean(key) && loadedKey !== key && !error,
    reload,
  };
}
