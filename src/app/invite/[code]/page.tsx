'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Wallet,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { translateApiError } from '@/lib/i18n/api-errors';
import { interpolate } from '@/lib/i18n/translator';

interface InviteMember {
  name: string;
  avatarUrl: string | null;
  role: string;
}

interface InviteDetails {
  invite: {
    code: string;
    role: string;
    targetEmail?: string | null;
    createdAt: string;
  };
  wallet: {
    id: string;
    name: string;
    currency: string;
    color: string;
    icon: string;
    memberCount: number;
    members: InviteMember[];
  };
}

export default function InviteJoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { currentUser, setCurrentUser, refreshWallets, setActiveWalletId, showToast } = useApp();
  const { t } = useTranslation();

  const [inviteData, setInviteData] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  // Optional new profile fields
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [useCustomProfile, setUseCustomProfile] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/invite/${code}`);
        if (!res.ok) {
          const err = await res.json();
          setError(translateApiError(err.error, res.status, t));
        } else {
          const data: InviteDetails = await res.json();
          setInviteData(data);
          if (data.invite.targetEmail) {
            setCustomEmail(data.invite.targetEmail);
          }
        }
      } catch {
        setError(t('invites.errorLoading'));
      } finally {
        setIsLoading(false);
      }
    }
    if (code) {
      loadInvite();
    }
  }, [code, t]);

  const handleJoin = async () => {
    try {
      setIsJoining(true);
      setError(null);
      const payload: { name?: string; email?: string } = {};
      if (useCustomProfile && customName && customEmail) {
        payload.name = customName.trim();
        payload.email = customEmail.trim();
      }

      const res = await fetch(`/api/invite/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser && !useCustomProfile ? { 'x-user-id': currentUser.id } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(translateApiError(data.error, res.status, t));
      } else {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
        });

        if (data.user) {
          setCurrentUser(data.user);
        }

        await refreshWallets();
        if (data.walletId) {
          setActiveWalletId(data.walletId);
        }

        showToast(t('invites.joinedWalletSuccess'));
        router.push('/');
      }
    } catch (err) {
      console.error('Error joining wallet:', err);
      setError(t('invites.unexpectedError'));
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-500">{t('invites.checkingCode')}</p>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-900 shadow-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{t('invites.unavailableTitle')}</h2>
        <p className="text-xs text-zinc-500 mt-2 mb-6">
          {error || t('invites.unavailableDesc')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold cursor-pointer"
        >
          {t('invites.returnToDashboard')}
        </button>
      </div>
    );
  }

  if (!inviteData) return null;

  const { wallet, invite } = inviteData;
  const isTargeted = Boolean(invite.targetEmail);
  const activeEmail = useCustomProfile ? customEmail.trim().toLowerCase() : (currentUser?.email?.toLowerCase() || '');
  const targetEmailLower = (invite.targetEmail || '').toLowerCase();
  const isEmailMatching = !isTargeted || activeEmail === targetEmailLower;

  return (
    <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in zoom-in-95">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-white shadow-lg mb-4"
          style={{ backgroundColor: wallet.color }}
        >
          <Wallet className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-200/60 dark:border-indigo-800/60 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('invites.invitedTitle')}</span>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
          {interpolate(t('invites.joinWalletName'), { name: wallet.name })}
        </h1>

        <p className="text-xs text-zinc-500 mt-1.5">
          {t('invites.joinDescription')}
        </p>
      </div>

      {/* Target Email Restriction Banner */}
      {isTargeted && !isEmailMatching && (
        <div className="my-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs leading-relaxed animate-in fade-in">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold block text-amber-950 dark:text-amber-100">
              {t('invites.lockedWarningTitle')}
            </strong>
            <p className="mt-0.5">
              {interpolate(t('invites.lockedWarningMessage'), { email: invite.targetEmail || '' })}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="my-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="my-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">{t('invites.accessRole')}:</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
            {t.roles[invite.role as keyof typeof t.roles] || invite.role}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">{t('invites.currentMembers')}:</span>
          <span className="font-bold text-zinc-800 dark:text-zinc-200">
            {interpolate(t(wallet.memberCount === 1 ? 'budget.membersCountOne' : 'budget.membersCountMany'), { count: wallet.memberCount })}
          </span>
        </div>

        {/* Member Avatars */}
        <div className="flex items-center gap-1.5 pt-1">
          {wallet.members.map((m, idx) => (
            <div key={idx} className="relative group">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatarUrl}
                  alt={m.name}
                  className="w-7 h-7 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800"
                  title={`${m.name} (${t.roles[m.role as keyof typeof t.roles] || m.role})`}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold">
                  {m.name.slice(0, 1)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Join Option Switch */}
      {currentUser && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setUseCustomProfile(!useCustomProfile)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            {useCustomProfile
              ? `← ${t('invites.useExistingProfile')} ${currentUser.name}`
              : t('invites.useCustomProfile')}
          </button>
        </div>
      )}

      {useCustomProfile && (
        <div className="space-y-3 mb-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t('invites.fullNameLabel')}
            </label>
            <input
              type="text"
              required
              placeholder={t('invites.namePlaceholder')}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t('invites.emailLabel')}
            </label>
            <input
              type="email"
              required
              placeholder={invite.targetEmail || t('invites.emailPlaceholder')}
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* Accept & Join Button */}
      <button
        type="button"
        disabled={isJoining || !isEmailMatching}
        onClick={handleJoin}
        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span>
          {isJoining
            ? t('invites.joiningWallet')
            : !isEmailMatching
            ? interpolate(t('invites.lockedToEmail'), { email: invite.targetEmail || '' })
            : useCustomProfile
            ? t('invites.joinWallet')
            : `${t('invites.joinAs')} ${currentUser?.name || t('roles.MEMBER')}`}
        </span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
