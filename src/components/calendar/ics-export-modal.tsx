'use client';

import React, { useCallback, useState } from 'react';
import { X, Calendar, Download, Copy, Check, ExternalLink, RotateCcw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';

export function IcsExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { walletData, currentUser, showToast } = useApp();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const walletId = walletData?.wallet.id;

  // The feed URL carries a per-member secret (calendar apps cannot send cookies), so it is fetched, never derived.
  const requestFeedToken = useCallback(
    async (rotate: boolean) => {
      if (!walletId) return null;
      const res = await fetch(`/api/wallets/${walletId}/calendar-token`, {
        method: rotate ? 'POST' : 'GET',
        headers: currentUser ? { 'x-user-id': currentUser.id } : {},
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data: { token?: unknown } = await res.json();
      return typeof data.token === 'string' ? data.token : null;
    },
    [walletId, currentUser],
  );

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    requestFeedToken(false)
      .then((token) => {
        if (cancelled) return;
        setFeedToken(token);
        if (!token) showToast(t('icsModal.linkLoadFailed'));
      })
      .catch(() => {
        if (!cancelled) showToast(t('icsModal.linkLoadFailed'));
      });
    return () => {
      cancelled = true;
      setFeedToken(null);
    };
  }, [isOpen, requestFeedToken, showToast, t]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !walletData) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const icsDownloadUrl = feedToken
    ? `/api/wallets/${walletData.wallet.id}/calendar.ics?token=${encodeURIComponent(feedToken)}`
    : '';
  const fullIcsUrl = feedToken ? `${origin}${icsDownloadUrl}` : '';
  // WebCal URL format for Apple Calendar
  const webcalUrl = fullIcsUrl.replace(/^https?:\/\//, 'webcal://');

  const handleCopyLink = () => {
    if (!fullIcsUrl) return;
    navigator.clipboard.writeText(fullIcsUrl);
    setCopied(true);
    showToast(t('icsModal.copiedToast'));
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetLink = async () => {
    if (!window.confirm(t('icsModal.resetLinkConfirm'))) return;
    setIsResetting(true);
    try {
      const token = await requestFeedToken(true);
      if (token) {
        setFeedToken(token);
        showToast(t('icsModal.resetLinkDone'));
      } else {
        showToast(t('icsModal.linkLoadFailed'));
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/60">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {t('icsModal.title')}
              </h2>
              <p className="text-xs text-zinc-500">
                {t('icsModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('icsModal.description')}
          </p>

          {/* Option 1: Direct Download .ics & Direct WebCal */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  {t('icsModal.option1Title')}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t('icsModal.option1Desc')}
                </p>
              </div>
              <div className={`flex items-center gap-2 ${feedToken ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!feedToken}>
                <a
                  href={webcalUrl || undefined}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-indigo-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('icsModal.subscribeButton')}</span>
                </a>
                <a
                  href={icsDownloadUrl || undefined}
                  download={`${walletData.wallet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-bills.ics`}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('icsModal.icsFileButton')}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Option 2: Live Subscription Link */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-900 dark:text-white mb-1">
              {t('icsModal.option2Title')}
            </p>
            <p className="text-[11px] text-zinc-500 mb-2">
              {t('icsModal.option2Desc')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullIcsUrl}
                placeholder={t('icsModal.linkLoading')}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 text-xs font-mono text-zinc-800 dark:text-zinc-300 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!feedToken}
                className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 disabled:opacity-50 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('common.copied') : t('icsModal.copyFeed')}</span>
              </button>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {t('icsModal.privateLinkNote')}
              </p>
              <button
                type="button"
                onClick={handleResetLink}
                disabled={!feedToken || isResetting}
                className="shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('icsModal.resetLink')}</span>
              </button>
            </div>
          </div>

          {/* Instructions Accordion / Guide */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1.5 text-zinc-700 dark:text-zinc-300">
            <p className="font-bold text-indigo-900 dark:text-indigo-300">
              {t('icsModal.instructionsTitle')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              <li><strong>{t('icsModal.appleCalendar')}</strong> {t('icsModal.appleCalendarStep')}</li>
              <li><strong>{t('icsModal.googleCalendar')}</strong> {t('icsModal.googleCalendarStep')}</li>
              <li><strong>{t('icsModal.outlook')}</strong> {t('icsModal.outlookStep')}</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
