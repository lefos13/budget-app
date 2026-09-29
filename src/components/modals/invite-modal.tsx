'use client';

import React, { useState } from 'react';
import { X, UserPlus, Copy, Check, Shield, Users, RefreshCw, Mail, Lock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';

export function InviteModal() {
  const {
    isInviteOpen,
    setIsInviteOpen,
    walletData,
    activeWalletId,
    currentUser,
    refreshWallet,
    showToast,
  } = useApp();
  const { t } = useTranslation();

  const [copied, setCopied] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'MEMBER' | 'VIEWER'>('MEMBER');
  const [targetEmail, setTargetEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  React.useEffect(() => {
    if (!isInviteOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) setIsInviteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInviteOpen, isGenerating, setIsInviteOpen]);

  if (!isInviteOpen || !walletData) return null;

  const currentInvite = walletData.wallet.members ? walletData.wallet.invites?.[0] : null;
  const inviteCode = currentInvite?.code || 'SHARE-2026';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const inviteUrl = `${origin}/invite/${inviteCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    showToast(t('toasts.inviteCopied'));
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGenerateNew = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch(`/api/wallets/${activeWalletId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        body: JSON.stringify({
          role: selectedRole,
          targetEmail: targetEmail.trim() || undefined,
        }),
      });
      if (res.ok) {
        showToast(
          targetEmail.trim()
            ? `Generated targeted invite for ${targetEmail.trim()}`
            : t('toasts.inviteCreated')
        );
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to generate invite:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={() => setIsInviteOpen(false)} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {t('invites.modalTitle')}
              </h2>
              <p className="text-xs text-zinc-500">{t('invites.modalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsInviteOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Wallet summary pill */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: walletData.wallet.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                {walletData.wallet.name}
              </p>
              <p className="text-[11px] text-zinc-500">
                {walletData.wallet.members?.length || 1} active member
                {walletData.wallet.members?.length === 1 ? '' : 's'}
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              Invite Active
            </span>
          </div>

          {/* Targeted Invitee Email Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>{t('invites.targetEmailLabel')}</span>
              <span className="text-[10px] text-zinc-400">Optional</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="email"
                placeholder={t('invites.targetEmailPlaceholder')}
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {targetEmail.trim() ? (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1.5 font-medium flex items-center gap-1.5">
                <Lock className="w-3 h-3 shrink-0" />
                <span>{t('invites.targetEmailLockedNote')}</span>
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400 mt-1">{t('invites.targetEmailHelp')}</p>
            )}
          </div>

          {/* Shareable Link Box */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('invites.shareableLinkLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-xs font-mono text-zinc-800 dark:text-zinc-300 select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('common.copied') : t('common.copy')}</span>
              </button>
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('invites.roleLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('MEMBER')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedRole === 'MEMBER'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {t('invites.roles.member')}
                  </span>
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-[11px] text-zinc-500 leading-tight">
                  {t('invites.roles.memberDesc')}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('VIEWER')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedRole === 'VIEWER'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {t('invites.roles.viewer')}
                  </span>
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <p className="text-[11px] text-zinc-500 leading-tight">
                  {t('invites.roles.viewerDesc')}
                </p>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateNew}
              className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>
                {isGenerating
                  ? t('common.processing')
                  : targetEmail.trim()
                  ? t('invites.sendInvite')
                  : t('invites.generateNewCode')}
              </span>
            </button>
            <span className="text-[11px] text-zinc-400 font-mono">Code: {inviteCode}</span>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsInviteOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
