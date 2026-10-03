'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { KeyRound, Plus, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatDate } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { useAddPasskey } from './use-add-passkey';

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

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingRename, setIsSavingRename] = useState(false);

  // Delete state
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { authMode, showToast } = useApp();
  const { t, dateLocale } = useTranslation();
  const { isAdding, addPasskey } = useAddPasskey();

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
    await addPasskey(fetchPasskeys);
  };

  const startRename = (p: PasskeyItem) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditError(null);
    setConfirmingDeleteId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
    setEditError(null);
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editName.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
      setEditError(t.passkeys.nameLengthError);
      return;
    }

    setIsSavingRename(true);
    try {
      const res = await fetch(`/api/auth/passkeys/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(translateApiError(errData.error, res.status, t));
        return;
      }

      const data = await res.json();
      setPasskeys((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data.passkey } : item))
      );
      showToast(t.passkeys.renamedToast);
      cancelRename();
    } catch (err) {
      console.error('Failed to update passkey:', err);
      showToast(t.passkeys.genericError);
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/auth/passkeys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(translateApiError(errData.error, res.status, t));
        return;
      }

      setPasskeys((prev) => prev.filter((item) => item.id !== id));
      showToast(t.passkeys.deletedToast);
      setConfirmingDeleteId(null);
    } catch (err) {
      console.error('Failed to delete passkey:', err);
      showToast(t.passkeys.genericError);
    } finally {
      setIsDeleting(false);
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
          {passkeys.map((p) => {
            const isEditing = editingId === p.id;
            const isConfirmingDelete = confirmingDeleteId === p.id;

            return (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleSaveRename(p.id);
                          }}
                          className="flex flex-col gap-1.5"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => {
                                setEditName(e.target.value);
                                if (editError) setEditError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelRename();
                                }
                              }}
                              maxLength={50}
                              autoFocus
                              placeholder={t.passkeys.namePlaceholder}
                              className="px-2.5 py-1 text-xs sm:text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px] max-w-xs"
                            />
                            <button
                              type="submit"
                              disabled={isSavingRename}
                              aria-label={interpolate(t.passkeys.saveAriaLabel, { name: p.name })}
                              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isSavingRename ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              disabled={isSavingRename}
                              aria-label={t.passkeys.cancel}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          {editError && (
                            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">
                              {editError}
                            </p>
                          )}
                        </form>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing && !isConfirmingDelete && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startRename(p)}
                        aria-label={interpolate(t.passkeys.renameAriaLabel, { name: p.name })}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingDeleteId(p.id);
                          setEditingId(null);
                        }}
                        aria-label={interpolate(t.passkeys.removeAriaLabel, { name: p.name })}
                        className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {isConfirmingDelete && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                    <p className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                      {t.passkeys.removeConfirm}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={isDeleting}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        {t.passkeys.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConfirmDelete(p.id)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            <span>{t.passkeys.removing}</span>
                          </>
                        ) : (
                          <span>{t.passkeys.remove}</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
