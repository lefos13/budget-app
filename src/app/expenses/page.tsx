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
  CalendarClock,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { useApp, ExpenseItem, PlannedExpenseItem } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { MonthSwitcher } from '@/components/month-switcher';
import { getCurrentMonthKey, compareMonthKeys } from '@/lib/month';

export default function ExpensesPage() {
  const {
    walletData,
    currentUser,
    activeWalletId,
    isLoading,
    refreshWallet,
    showToast,
    openAddExpense,
    openEditExpense,
    openEditPlannedExpense,
    setIsAddExpenseOpen,
    setIsNewWalletOpen,
    selectedMonth,
  } = useApp();
  const { t, dateLocale } = useTranslation();

  const [expensesList, setExpensesList] = useState<ExpenseItem[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPlannedId, setDeletingPlannedId] = useState<string | null>(null);
  const [isDeletingPlanned, setIsDeletingPlanned] = useState(false);
  const [realizingPlannedId, setRealizingPlannedId] = useState<string | null>(null);

  const currentFetchKey = activeWalletId ? `${activeWalletId}:${selectedMonth}` : null;
  const isFetched = Boolean(currentFetchKey && fetchedKey === currentFetchKey);

  useEffect(() => {
    if (!activeWalletId) return;
    let isMounted = true;
    const fetchKey = `${activeWalletId}:${selectedMonth}`;
    const fetchExpenses = async () => {
      try {
        const res = await fetch(`/api/expenses?walletId=${activeWalletId}&month=${selectedMonth}&limit=200`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setExpensesList(data.expenses || []);
            setFetchedKey(fetchKey);
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
  }, [activeWalletId, selectedMonth, walletData]);

  const currency = walletData?.wallet.currency || 'EUR';
  const effectiveExpenses = useMemo(() => {
    if (!activeWalletId) return [];
    if (isFetched) {
      return expensesList;
    }
    return walletData?.monthExpenses || [];
  }, [activeWalletId, isFetched, expensesList, walletData?.monthExpenses]);

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
        showToast(interpolate(t('expenses.deletedToast'), { title }));
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePlanned = async (id: string, title: string) => {
    try {
      setIsDeletingPlanned(true);
      const res = await fetch(`/api/planned-expenses/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
      });
      if (res.ok) {
        showToast(t('planned.deletedToast').replace('{title}', title));
        setDeletingPlannedId(null);
        await refreshWallet();
      } else {
        showToast(t('planned.errorGeneric'));
      }
    } catch (err) {
      console.error('Failed to delete planned expense:', err);
      showToast(t('planned.errorGeneric'));
    } finally {
      setIsDeletingPlanned(false);
    }
  };

  const handleRealizePlanned = async (p: PlannedExpenseItem) => {
    if (realizingPlannedId) return;
    setRealizingPlannedId(p.id);
    try {
      const expectedDateIso = new Date(p.expectedDate).toISOString().slice(0, 10);
      const expectedMonth = expectedDateIso.slice(0, 7);
      const currentRealMonth = getCurrentMonthKey();
      const isBeforeCurrentMonth = compareMonthKeys(expectedMonth, currentRealMonth) < 0;

      const payload = isBeforeCurrentMonth ? { date: expectedDateIso } : {};

      const res = await fetch(`/api/planned-expenses/${p.id}/realize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(t('planned.realizedToast').replace('{title}', p.title));
        await refreshWallet();
      } else if (res.status === 409) {
        showToast(t('planned.alreadyRealized'));
        await refreshWallet();
      } else if (res.status === 403) {
        showToast(t('planned.realizeForbidden'));
      } else {
        showToast(t('planned.realizeFailed'));
      }
    } catch (err) {
      console.error('Failed to realize planned expense:', err);
      showToast(t('planned.realizeFailed'));
    } finally {
      setRealizingPlannedId(null);
    }
  };

  const isViewer = walletData?.userRole === 'VIEWER';
  const plannedExpenses = useMemo(
    () => walletData?.plannedExpenses || [],
    [walletData?.plannedExpenses]
  );
  const pendingPlanned = useMemo(
    () => plannedExpenses.filter((p) => p.status === 'PENDING'),
    [plannedExpenses]
  );
  const totalPendingPlannedAmount = useMemo(
    () => pendingPlanned.reduce((sum, p) => sum + p.amount, 0),
    [pendingPlanned]
  );

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-zinc-500">{t('expenses.loadingExpenses')}</p>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-200/80 dark:border-indigo-800 shadow-md">
          <Layers className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white">{t('expenses.noWalletSelected')}</h1>
        <p className="text-sm text-zinc-500 mt-2 mb-6">{t('expenses.noWalletDesc')}</p>
        <button
          type="button"
          onClick={() => setIsNewWalletOpen(true)}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
        >
          {t('nav.createNewWallet')}
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
              {t('expenses.title')}
            </h1>
            <p className="text-xs text-zinc-500">
              {t('expenses.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <MonthSwitcher />
          <button
            type="button"
            onClick={() => setIsAddExpenseOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('expenses.addNew')}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t('metrics.totalSpending')}
            </p>
            <TrendingDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(totalFilteredSpent, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">
            {interpolate(t(filteredExpenses.length === 1 ? 'expenses.transactionsCountOne' : 'expenses.transactionsCountMany'), { count: filteredExpenses.length })}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t('metrics.averageExpense')}
            </p>
            <Receipt className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(averageSpent, currency)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">{t('expenses.perTransaction')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t('metrics.activeEnvelopes')}
            </p>
            <Tag className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {interpolate(t((walletData?.categories.length || 0) === 1 ? 'categories.categoriesCountOne' : 'categories.categoriesCountMany'), { count: walletData?.categories.length || 0 })}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">{t('expenses.withBudgetCaps')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t('metrics.payersActive')}
            </p>
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {interpolate(t((walletData?.wallet.members?.length || 1) === 1 ? 'budget.membersCountOne' : 'budget.membersCountMany'), { count: walletData?.wallet.members?.length || 1 })}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">{t('expenses.sharingWallet')}</p>
        </div>
      </div>

      {/* Planned / Upcoming Section */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/60 shadow-xs">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                  {t('planned.sectionTitle')}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                  {pendingPlanned.length}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('planned.totalLabel')}: <strong className="text-zinc-900 dark:text-white tabular-nums font-semibold">{formatCurrency(totalPendingPlannedAmount, currency)}</strong>
              </p>
            </div>
          </div>

          {!isViewer && (
            <button
              type="button"
              onClick={() => openAddExpense(undefined, 'PLANNED')}
              className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs shadow-amber-600/20 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('planned.addPlanned')}</span>
            </button>
          )}
        </div>

        {plannedExpenses.length === 0 ? (
          <div className="text-center py-10 px-4">
            <CalendarClock className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t('planned.emptyState')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {plannedExpenses.map((p) => {
              const isRealized = p.status === 'REALIZED';
              return (
                <div
                  key={p.id}
                  className={`group px-5 sm:px-6 py-4 transition-colors ${
                    isRealized
                      ? 'opacity-60 dark:opacity-50'
                      : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {p.title}
                        </span>
                        {p.category ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              backgroundColor: `${p.category.color}15`,
                              color: p.category.color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: p.category.color }}
                            />
                            <span>{p.category.name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            <span>{t('planned.uncategorised')}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                        <span>{formatDate(p.expectedDate, 'MMM d', dateLocale)}</span>
                        {p.notes && (
                          <>
                            <span>·</span>
                            <span className="italic truncate max-w-xs text-zinc-500">
                              &quot;{p.notes}&quot;
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {p.status === 'PENDING' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                          {t('planned.statusPending')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                          {t('planned.statusSpent')}
                        </span>
                      )}

                      <span className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tabular-nums">
                        {formatCurrency(p.amount, currency)}
                      </span>

                      {!isViewer && p.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={realizingPlannedId === p.id || isDeletingPlanned}
                          onClick={() => handleRealizePlanned(p)}
                          className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={t('planned.markSpent')}
                          title={t('planned.markSpentTitle')}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isViewer && p.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => openEditPlannedExpense(p)}
                          className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          aria-label={t('expenseEdit.edit')}
                          title={t('expenseEdit.edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isViewer && (
                        <button
                          type="button"
                          disabled={isDeletingPlanned}
                          onClick={() =>
                            setDeletingPlannedId(deletingPlannedId === p.id ? null : p.id)
                          }
                          className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title={t('planned.deleteButton')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {deletingPlannedId === p.id && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <p className="text-xs text-rose-800 dark:text-rose-200 font-medium">
                        {t('planned.deleteConfirm')}
                      </p>
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          disabled={isDeletingPlanned}
                          onClick={() => setDeletingPlannedId(null)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingPlanned}
                          onClick={() => handleDeletePlanned(p.id, p.title)}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isDeletingPlanned ? t('common.processing') : t('common.delete')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={t('expenses.searchPlaceholder')}
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
              <option value="ALL">{t('expenses.allCategories')}</option>
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
              <option value="ALL">{t('expenses.allPayers')}</option>
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
              <option value="date-desc">{t('expenses.sortBy.newest')}</option>
              <option value="date-asc">{t('expenses.sortBy.oldest')}</option>
              <option value="amount-desc">{t('expenses.sortBy.highest')}</option>
              <option value="amount-asc">{t('expenses.sortBy.lowest')}</option>
            </select>
          </div>

          {/* Reset Filters */}
          {isFiltering && (
            <button
              type="button"
              onClick={resetFilters}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={t('expenses.resetFilters')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expenses Table / List */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>{interpolate(t(filteredExpenses.length === 1 ? 'expenses.transactionsMatchCountOne' : 'expenses.transactionsMatchCountMany'), { count: filteredExpenses.length })}</span>
          <span>
            {t('expenses.totalFiltered')}: <strong className="text-zinc-900 dark:text-white tabular-nums">{formatCurrency(totalFilteredSpent, currency)}</strong>
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-20">
            <CreditCard className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">{t('expenses.noMatching')}</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              {t('expenses.noMatchingSub')}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                {t('expenses.clearAllFilters')}
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
                        title={interpolate(t('expenses.paidBy'), { name: exp.user.name })}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                        {/* i18n-ignore: fallback avatar initial */}
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
                            {t('expenses.recurring')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
                        <span>{formatDate(exp.date, 'MMM d, yyyy', dateLocale)}</span>
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

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-base font-black text-zinc-900 dark:text-white tabular-nums mr-1">
                      -{formatCurrency(exp.amount, currency)}
                    </span>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => openEditExpense(exp)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                        aria-label={t('expenseEdit.edit')}
                        title={t('expenseEdit.edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(exp.id, exp.title)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-zinc-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
                      title={t('recentExpenses.deleteExpense')}
                      aria-label={t('recentExpenses.deleteExpense')}
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
