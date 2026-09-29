'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Trash2,
  Tag,
  ArrowUpDown,
  Users,
  RotateCcw,
  TrendingDown,
  Receipt,
  Layers,
} from 'lucide-react';
import { useApp, ExpenseItem } from '@/context/AppContext';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function ExpensesPage() {
  const { walletData, activeWalletId, isLoading, refreshWallet, showToast, setIsAddExpenseOpen, setIsNewWalletOpen } = useApp();

  const [expensesList, setExpensesList] = useState<ExpenseItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWalletId) return;
    let isMounted = true;
    const fetchExpenses = async () => {
      try {
        const res = await fetch(`/api/expenses?walletId=${activeWalletId}&limit=200`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setExpensesList(data.expenses || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch full expenses:', err);
      }
    };
    void fetchExpenses();
    return () => {
      isMounted = false;
    };
  }, [activeWalletId, walletData]);

  const currency = walletData?.wallet.currency || 'EUR';
  const effectiveExpenses = useMemo(() => {
    if (!activeWalletId) return [];
    return expensesList.length > 0 ? expensesList : (walletData?.recentExpenses || []);
  }, [activeWalletId, expensesList, walletData]);

  const filteredExpenses = useMemo(() => {
    if (!effectiveExpenses || effectiveExpenses.length === 0) return [];

    let list = [...effectiveExpenses];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          e.user?.name.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((e) => e.categoryId === selectedCategory);
    }

    if (selectedUser !== 'ALL') {
      list = list.filter((e) => e.userId === selectedUser);
    }

    list.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [effectiveExpenses, search, selectedCategory, selectedUser, sortBy]);

  const totalFilteredSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const averageSpent = filteredExpenses.length > 0 ? totalFilteredSpent / filteredExpenses.length : 0;

  const isFiltering = search.trim() !== '' || selectedCategory !== 'ALL' || selectedUser !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedUser('ALL');
    setSortBy('date-desc');
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted expense "${title}"`);
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-zinc-500">Loading wallet expenses...</p>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-200/80 dark:border-indigo-800 shadow-md">
          <Layers className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white">No Wallet Selected</h1>
        <p className="text-sm text-zinc-500 mt-2 mb-6">Create or select a wallet to view and manage expenses.</p>
        <button
          type="button"
          onClick={() => setIsNewWalletOpen(true)}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
        >
          Create New Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Expense Management
            </h1>
            <p className="text-xs text-zinc-500">
              Track shared receipts, food, utility bills & category pacing
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddExpenseOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Expense</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Spending
            </p>
            <TrendingDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(totalFilteredSpent, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">
            {filteredExpenses.length} transactions
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Average Expense
            </p>
            <Receipt className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(averageSpent, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">per transaction</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Active Envelopes
            </p>
            <Tag className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {walletData?.categories.length || 0} categories
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">with budget caps</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Payers Active
            </p>
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {walletData?.wallet.members?.length || 1} members
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">sharing wallet</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search transactions by title, notes, or payer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Select */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-200 font-semibold"
            >
              <option value="ALL">All Categories</option>
              {walletData?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Member / Payer Select */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-200 font-semibold"
            >
              <option value="ALL">All Payers</option>
              {walletData?.wallet.members?.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc')}
              className="text-xs py-2 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-200 font-semibold"
            >
              <option value="date-desc">Newest Date</option>
              <option value="date-asc">Oldest Date</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>

          {/* Reset Filters */}
          {isFiltering && (
            <button
              type="button"
              onClick={resetFilters}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expenses Table / List */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>{filteredExpenses.length} transactions match</span>
          <span>
            Total: <strong className="text-zinc-900 dark:text-white tabular-nums">{formatCurrency(totalFilteredSpent, currency)}</strong>
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-20">
            <CreditCard className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">No matching expenses found</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search criteria or clear the active category and payer filters.
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filteredExpenses.map((exp) => {
              const isDeleting = deletingId === exp.id;
              return (
                <div
                  key={exp.id}
                  className="group px-6 py-4 flex items-center justify-between hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    {exp.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exp.user.avatarUrl}
                        alt={exp.user.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-zinc-300 dark:ring-zinc-700 shadow-xs"
                        title={`Paid by ${exp.user.name}`}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                        {exp.user?.name?.slice(0, 1) || 'U'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {exp.title}
                        </p>
                        {exp.isRecurring && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                            recurring
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
                        <span>{formatDate(exp.date, 'MMM d, yyyy')}</span>
                        <span>·</span>
                        <span className="text-zinc-600 dark:text-zinc-300 font-semibold">{exp.user?.name}</span>
                        {exp.category && (
                          <>
                            <span>·</span>
                            <span
                              className="font-bold px-1.5 py-0.5 rounded-md text-[10px]"
                              style={{
                                backgroundColor: `${exp.category.color}15`,
                                color: exp.category.color,
                              }}
                            >
                              {exp.category.name}
                            </span>
                          </>
                        )}
                        {exp.notes && (
                          <>
                            <span>·</span>
                            <span className="italic truncate max-w-xs text-zinc-500">
                              &quot;{exp.notes}&quot;
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      -{formatCurrency(exp.amount, currency)}
                    </span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(exp.id, exp.title)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-zinc-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
