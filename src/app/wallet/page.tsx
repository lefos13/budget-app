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
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ImportWalletModal } from '@/components/modals/import-wallet-modal';
import { PendingInvitesBanner } from '@/components/pending-invites-banner';

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
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">No Wallet Selected</h1>
          <p className="text-sm text-zinc-500 mt-2 mb-6">
            Create or select a wallet to manage members, permissions, and budgets.
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
      showToast('Failed to export wallet data');
    } finally {
      setIsExporting(false);
    }
  };

  const membersCount = walletData.wallet.members?.length || 1;

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
                walletData.wallet.activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {log.details}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(log.timestamp, 'MMM d, yyyy · h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                ))
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
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CHF">CHF (Fr)</option>
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
        </div>
      </div>

      {/* Import Modal */}
      <ImportWalletModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
