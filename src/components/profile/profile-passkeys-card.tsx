'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { KeyRound, Plus, Loader2 } from 'lucide-react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatDate } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';

interface PasskeyItem {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string;
  backedUp: boolean;
}

const emptySubscribe = () => () => {};

export function ProfilePasskeysCard() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const { authMode, showToast } = useApp();
  const { t, dateLocale } = useTranslation();

  const isSupported = useSyncExternalStore(
    emptySubscribe,
    () => browserSupportsWebAuthn(),
    () => false
  );

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/passkeys', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch (err) {
      console.error('Failed to fetch passkeys:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authMode !== 'normal') return;
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/auth/passkeys', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPasskeys(data.passkeys || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch passkeys:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [authMode]);

  if (authMode !== 'normal') {
    return null;
  }

  const handleAddPasskey = async () => {
    setIsAdding(true);
    try {
      const optRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        credentials: 'include',
      });
      if (!optRes.ok) {
        const errData = await optRes.json().catch(() => ({}));
        showToast(translateApiError(errData.error, optRes.status, t));
        return;
      }
      const optionsJSON = await optRes.json();

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON });
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error?.name === 'NotAllowedError') {
          // User cancelled the prompt quietly
          return;
        }
        if (error?.name === 'InvalidStateError') {
          showToast(t.passkeys.alreadyRegistered);
          return;
        }
        showToast(error?.message || t.passkeys.genericError);
        return;
      }

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(attResp),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        showToast(translateApiError(errData.error, verifyRes.status, t));
        return;
      }

      showToast(t.passkeys.createdToast);
      await fetchPasskeys();
    } catch (err) {
      console.error('Error during passkey registration:', err);
      showToast(t.passkeys.genericError);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section
      id="passkeys"
      aria-labelledby="profile-passkeys-title"
      className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            id="profile-passkeys-title"
            className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2"
          >
            <KeyRound className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            <span>{t.passkeys.title}</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t.passkeys.subtitle}
          </p>
        </div>

        {isSupported && (
          <button
            type="button"
            onClick={handleAddPasskey}
            disabled={isAdding}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>{t.passkeys.adding}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{t.passkeys.addPasskey}</span>
              </>
            )}
          </button>
        )}
      </div>

      {isSupported === false && (
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
          <p>{t.passkeys.notSupported}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" aria-hidden="true" />
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t.passkeys.loading}
          </span>
        </div>
      ) : passkeys.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {t.passkeys.emptyTitle}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            {t.passkeys.emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/30">
          {passkeys.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {p.name}
                    </span>
                    {p.backedUp && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60">
                        {t.passkeys.synced}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {interpolate(t.passkeys.addedDate, {
                        date: formatDate(p.createdAt, 'MMM d, yyyy', dateLocale),
                      })}
                    </span>
                    <span>·</span>
                    <span>
                      {p.lastUsedAt
                        ? interpolate(t.passkeys.lastUsedDate, {
                            date: formatDate(p.lastUsedAt, 'MMM d, yyyy', dateLocale),
                          })
                        : t.passkeys.neverUsed}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
