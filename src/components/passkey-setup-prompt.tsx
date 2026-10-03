'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { KeyRound, Plus, Loader2, X } from 'lucide-react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { useAddPasskey } from '@/components/profile/use-add-passkey';

const emptySubscribe = () => () => {};

export function PasskeySetupPrompt() {
  const { authMode, currentUser } = useApp();
  const { t } = useTranslation();
  const { isAdding, addPasskey } = useAddPasskey();

  const [hasPasskeys, setHasPasskeys] = useState<boolean | null>(null);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  const isSupported = useSyncExternalStore(
    emptySubscribe,
    () => browserSupportsWebAuthn(),
    () => false
  );

  const storageDismissed = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      return () => window.removeEventListener('storage', onStoreChange);
    },
    () => {
      if (!currentUser?.id) return true;
      try {
        return Boolean(localStorage.getItem(`aura_passkey_prompt_dismissed:${currentUser.id}`));
      } catch {
        return true;
      }
    },
    () => true
  );

  const isDismissed = storageDismissed || manuallyDismissed;

  useEffect(() => {
    if (authMode !== 'normal' || !currentUser || !isSupported || isDismissed) {
      return;
    }

    let isMounted = true;
    async function checkPasskeys() {
      try {
        const res = await fetch('/api/auth/passkeys', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setHasPasskeys((data.passkeys || []).length > 0);
          }
        } else {
          if (isMounted) setHasPasskeys(true);
        }
      } catch {
        if (isMounted) setHasPasskeys(true);
      }
    }
    void checkPasskeys();

    return () => {
      isMounted = false;
    };
  }, [authMode, currentUser, isSupported, isDismissed]);

  if (
    authMode !== 'normal' ||
    !currentUser ||
    !isSupported ||
    isDismissed ||
    hasPasskeys !== false
  ) {
    return null;
  }

  const markDismissed = () => {
    if (currentUser) {
      try {
        localStorage.setItem(`aura_passkey_prompt_dismissed:${currentUser.id}`, '1');
      } catch {
        // ignore
      }
    }
    setManuallyDismissed(true);
  };

  const handleSetup = async () => {
    const success = await addPasskey();
    if (success) {
      markDismissed();
    }
  };

  return (
    <div
      role="region"
      aria-label={t.passkeys.promptTitle}
      className="p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
              {t.passkeys.promptTitle}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl">
              {t.passkeys.promptDescription}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-3">
              <button
                type="button"
                onClick={handleSetup}
                disabled={isAdding}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>{t.passkeys.adding}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>{t.passkeys.promptSetupAction}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={markDismissed}
                disabled={isAdding}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {t.passkeys.promptDismiss}
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={markDismissed}
          aria-label={t.passkeys.promptDismissAriaLabel}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
