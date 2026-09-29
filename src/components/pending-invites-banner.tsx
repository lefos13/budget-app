'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Wallet, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';

interface PendingInvite {
  id: string;
  code: string;
  role: string;
  targetEmail: string | null;
  wallet: {
    id: string;
    name: string;
    currency: string;
    color: string;
    icon: string;
  };
}

export function PendingInvitesBanner() {
  const { currentUser, refreshWallets, setActiveWalletId, showToast } = useApp();
  const { t } = useTranslation();

  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.email) return;
    let isMounted = true;
    async function loadPending() {
      try {
        const res = await fetch('/api/invites/pending', {
          headers: {
            'x-user-id': currentUser!.id,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setPendingInvites(data.invites || []);
        }
      } catch (err) {
        console.error('Failed to load pending invites:', err);
      }
    }
    void loadPending();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  if (pendingInvites.length === 0) return null;

  const handleAction = async (invite: PendingInvite, action: 'ACCEPT' | 'DECLINE') => {
    try {
      setProcessingId(invite.id);
      const res = await fetch('/api/invites/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser!.id,
        },
        body: JSON.stringify({
          inviteId: invite.id,
          action,
        }),
      });

      if (res.ok) {
        setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));

        if (action === 'ACCEPT') {
          confetti({
            particleCount: 70,
            spread: 70,
            origin: { y: 0.6 },
          });
          showToast(`Joined ${invite.wallet.name} successfully!`);
          await refreshWallets();
          setActiveWalletId(invite.wallet.id);
        } else {
          showToast(`Declined invitation to ${invite.wallet.name}`);
        }
      }
    } catch (err) {
      console.error('Error answering invite:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {pendingInvites.map((invite) => {
        const isProcessing = processingId === invite.id;

        return (
          <div
            key={invite.id}
            className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border-2 border-indigo-400/40 dark:border-indigo-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: invite.wallet.color || '#6366f1' }}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Targeted Invite
                  </span>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    ({invite.role})
                  </span>
                </div>
                <p className="text-sm font-black text-zinc-900 dark:text-white mt-0.5">
                  You&apos;ve been invited to join &quot;{invite.wallet.name}&quot;!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleAction(invite, 'DECLINE')}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('invites.decline')}</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleAction(invite, 'ACCEPT')}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isProcessing ? t('invites.accepting') : t('invites.accept')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
