'use client';

import React, { useState } from 'react';
import {
  Users,
  Wallet as WalletIcon,
  UserPlus,
  Shield,
  Clock,
  Check,
  Copy,
  Plus,
  Settings,
  Activity,
  Download,
  Upload,
  Database,
  Tag,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useApp, CategoryWithSpent } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ImportWalletModal } from '@/components/modals/import-wallet-modal';
import { PendingInvitesBanner } from '@/components/pending-invites-banner';
import { CategoryModal } from '@/components/modals/category-modal';
import { getCategoryIcon } from '@/lib/category-icons';

export default function WalletPage() {
  const {
    walletData,
    currentUser,
    activeWalletId,
    isLoading,
    refreshWallet,
    showToast,
    setIsInviteOpen,
    setIsNewWalletOpen,
  } = useApp();
  const { t, dateLocale } = useTranslation();

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSpent | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Sync state with walletData
  React.useEffect(() => {
    if (!walletData) return;
    const timer = setTimeout(() => {
      setName(walletData.wallet.name);
      setBudget(String(walletData.wallet.monthlyBudget));
      setCurrency(walletData.wallet.currency);
    }, 0);
    return () => clearTimeout(timer);
  }, [walletData]);

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-zinc-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-12 px-4">
        <PendingInvitesBanner />
        <div className="text-center py-12 px-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-200/80 dark:border-indigo-800 shadow-md">
            <WalletIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">{t('wallet.noWalletSelected')}</h1>
          <p className="text-sm text-zinc-500 mt-2 mb-6">
            {t('wallet.noWalletDesc')}
          </p>
          <button
            type="button"
            onClick={() => setIsNewWalletOpen(true)}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            {t('nav.createNewWallet')}
          </button>
        </div>
      </div>
    );
  }

  const isOwner = walletData.userRole === 'OWNER';
  const currentInvite = walletData.wallet.invites?.[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const inviteCode = currentInvite?.code || 'SHARE-2026';
  const inviteUrl = `${origin}/invite/${inviteCode}`;

  const handleCopy = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    showToast(t('toasts.inviteCopied'));
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleUpdateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !budget) return;

    try {
      setIsUpdating(true);
      const res = await fetch(`/api/wallets/${activeWalletId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          monthlyBudget: parseFloat(budget),
          currency,
        }),
      });

      if (res.ok) {
        showToast(t('toasts.walletUpdated'));
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to update wallet:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportWallet = async () => {
    if (!activeWalletId || !walletData) return;
    try {
      setIsExporting(true);
      showToast(t('toasts.exportStarted'));
      const res = await fetch(`/api/wallets/${activeWalletId}/export`, {
        headers: currentUser ? { 'x-user-id': currentUser.id } : {},
      });
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const cleanName = walletData.wallet.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      a.download = `aura-wallet-${cleanName}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      showToast(t('wallet.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!activeWalletId) return;
    try {
      setIsDeletingCategory(true);
      const res = await fetch(`/api/wallets/${activeWalletId}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
      });
      if (res.ok) {
        showToast(t('categories.deletedToast'));
        setDeletingCategoryId(null);
        await refreshWallet();
      } else {
        showToast(t('categories.errorGeneric'));
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      showToast(t('categories.errorGeneric'));
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const membersCount = walletData.wallet.members?.length || 1;
  const totalCategoryLimits = (walletData.categories || []).reduce(
    (acc, c) => acc + (c.monthlyLimit || 0),
    0
  );
  const isLimitsOverBudget = totalCategoryLimits > (walletData.wallet.monthlyBudget || 0);

  return (
    <div className="space-y-8">
      {/* Targeted Pending Invites Banner */}
      <PendingInvitesBanner />

      {/* Header Bar */}
      <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
            style={{ backgroundColor: walletData.wallet.color }}
          >
            <WalletIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {walletData.wallet.name}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {walletData.userRole}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('wallet.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('common.invite')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewWalletOpen(true)}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('nav.createNewWallet')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Members & Invite Card & Activity Log */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Members Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    {t('wallet.membersTitle')}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {membersCount} {membersCount === 1 ? t('wallet.member') : t('wallet.members')}{' '}
                    {t('wallet.membersSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteOpen(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('wallet.inviteSomeone')}</span>
              </button>
            </div>

            <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {walletData.wallet.members?.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.avatarUrl}
                        alt={m.user.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-800 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-200 shrink-0">
                        {m.user?.name?.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                          {m.user?.name}
                        </p>
                        {m.user?.id === currentUser?.id && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                            {t('common.you')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{m.user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                        m.role === 'OWNER'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60'
                          : m.role === 'MEMBER'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      <span>{m.role}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shareable Invite Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    {t('wallet.activeInviteLink')}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {t('wallet.activeInviteSubtitle')}
                  </p>
                </div>
              </div>
              <span className="text-xs text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                {inviteCode}
              </span>
            </div>

            <p className="text-xs text-zinc-500 mt-3 mb-4 leading-relaxed">
              {t('wallet.activeInviteDescription')}
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-xs font-mono text-zinc-800 dark:text-zinc-200 select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleCopy(inviteCode, inviteUrl)}
                className={`px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  copiedCode === inviteCode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                {copiedCode === inviteCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode === inviteCode ? t('common.copied') : t('common.copyLink')}</span>
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  {t('wallet.activityTitle')}
                </h2>
                <p className="text-[11px] text-zinc-500">
                  {t('wallet.activitySubtitle')}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!walletData.wallet.activityLogs || walletData.wallet.activityLogs.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="w-6 h-6 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500">{t('wallet.noActivity')}</p>
                </div>
              ) : (
                walletData.wallet.activityLogs.map((log) => {
                  const dotColor =
                    log.action === 'CATEGORY_CREATED' ||
                    log.action === 'CATEGORY_UPDATED' ||
                    log.action === 'CATEGORY_DELETED'
                      ? 'bg-emerald-500'
                      : log.action === 'EXPENSE_ADDED'
                      ? 'bg-rose-500'
                      : log.action === 'BILL_PAID' || log.action === 'SUBSCRIPTION_PAID'
                      ? 'bg-teal-500'
                      : log.action === 'MEMBER_JOINED'
                      ? 'bg-blue-500'
                      : 'bg-indigo-500';

                  const actionTitle = t.activity[log.action as keyof typeof t.activity] || t.activity.generic;

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-3"
                    >
                      <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {actionTitle}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mt-0.5">
                          {log.details}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(log.timestamp, 'MMM d, yyyy · h:mm a', dateLocale)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Wallet Settings & Backup & Data Management */}
        <div className="space-y-6">
          {/* Backup & Data Management Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800/50">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  {t('wallet.backupCardTitle')}
                </h2>
                <p className="text-[11px] text-zinc-500">{t('wallet.backupCardSubtitle')}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Export Button */}
              <div className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  {t('wallet.exportButton')}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 mb-3 leading-relaxed">
                  {t('wallet.exportDescription')}
                </p>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExportWallet}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>{isExporting ? t('common.processing') : t('wallet.exportButton')}</span>
                </button>
              </div>

              {/* Import Button */}
              <div className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  {t('wallet.importButton')}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5 mb-3 leading-relaxed">
                  {t('wallet.importDescription')}
                </p>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('wallet.importButton')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Settings Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  {t('wallet.settingsTitle')}
                </h2>
                <p className="text-[11px] text-zinc-500">{t('wallet.settingsSubtitle')}</p>
              </div>
            </div>

            {!isOwner && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                {t('wallet.permissionNotice')}
              </div>
            )}

            <form onSubmit={handleUpdateWallet} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('wallet.walletNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  disabled={isUpdating || !isOwner}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('wallet.monthlyBudgetLabel')} ({currency})
                </label>
                <input
                  type="number"
                  step="10"
                  required
                  disabled={isUpdating || !isOwner}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  {t('wallet.targetPreview')}: {budget ? formatCurrency(parseFloat(budget) || 0, currency) : '—'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('wallet.monthlyBudgetHint')}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('wallet.currencyLabel')}
                </label>
                <select
                  value={currency}
                  disabled={isUpdating || !isOwner}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="EUR">{t('currencies.EUR')}</option>
                  <option value="USD">{t('currencies.USD')}</option>
                  <option value="GBP">{t('currencies.GBP')}</option>
                  <option value="CHF">{t('currencies.CHF')}</option>
                </select>
              </div>

              {isOwner && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdating ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Categories & Limits Card */}
          <div id="categories" className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    {t('categories.title')}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {t('categories.subtitle')}
                  </p>
                </div>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setIsCategoryModalOpen(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('categories.add')}</span>
                </button>
              )}
            </div>

            {!isOwner && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                {t('categories.ownerOnlyNote')}
              </div>
            )}

            <div className="mt-4 space-y-3">
              {(!walletData.categories || walletData.categories.length === 0) ? (
                <div className="py-8 text-center">
                  <Tag className="w-6 h-6 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500">{t('categories.emptyState')}</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {walletData.categories.map((cat) => {
                    const Icon = getCategoryIcon(cat.icon);
                    const limit = cat.monthlyLimit;
                    const hasLimit = limit !== null && limit > 0;
                    const spent = cat.spent || 0;
                    const percentage = hasLimit ? Math.round((spent / limit) * 100) : 0;
                    const isWarning = hasLimit && percentage >= 85 && percentage <= 100;
                    const isExceeded = hasLimit && spent > limit;

                    return (
                      <div key={cat.id} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                              style={{ backgroundColor: cat.color }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                                {cat.name}
                              </p>
                              <p className="text-xs text-zinc-400 tabular-nums">
                                {formatCurrency(spent, currency)}
                                {' · '}
                                {hasLimit ? formatCurrency(limit, currency) : t('categories.noLimit')}
                              </p>
                            </div>
                          </div>

                          {isOwner && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title={t('categories.edit')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletingCategoryId(deletingCategoryId === cat.id ? null : cat.id)
                                }
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title={t('categories.delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Progress bar when limit exists */}
                        {hasLimit && (
                          <div className="mt-2.5">
                            <div className="w-full h-1.5 bg-zinc-200/80 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : ''
                                }`}
                                style={{
                                  backgroundColor: isExceeded ? undefined : isWarning ? undefined : cat.color,
                                  width: `${Math.min(100, percentage)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Inline delete confirmation block */}
                        {deletingCategoryId === cat.id && (
                          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 mt-3 space-y-2">
                            <h4 className="text-xs font-bold text-rose-900 dark:text-rose-100">
                              {t('categories.deleteTitle')}
                            </h4>
                            <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                              {t('categories.deleteMessage')}
                            </p>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isDeletingCategory}
                                onClick={() => setDeletingCategoryId(null)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 cursor-pointer"
                              >
                                {t('common.cancel')}
                              </button>
                              <button
                                type="button"
                                disabled={isDeletingCategory}
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isDeletingCategory ? t('common.processing') : t('categories.deleteConfirm')}
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

            {/* Total limits info line & warning */}
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 tabular-nums">
                {t('categories.totalLimits')
                  .replace('{limits}', formatCurrency(totalCategoryLimits, currency))
                  .replace('{budget}', formatCurrency(walletData.wallet.monthlyBudget || 0, currency))}
              </p>

              {isLimitsOverBudget && (
                <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{t('categories.overBudgetWarning')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <ImportWalletModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Category Modal */}
      <CategoryModal
        open={isCategoryModalOpen}
        category={selectedCategory}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setSelectedCategory(null);
        }}
        onSaved={() => {
          setIsCategoryModalOpen(false);
          setSelectedCategory(null);
        }}
      />
    </div>
  );
}
