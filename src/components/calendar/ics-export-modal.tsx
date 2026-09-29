'use client';

import React, { useState } from 'react';
import { X, Calendar, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function IcsExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { walletData, showToast } = useApp();
  const [copied, setCopied] = useState(false);

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
  const icsDownloadUrl = `/api/wallets/${walletData.wallet.id}/calendar.ics`;
  const fullIcsUrl = `${origin}${icsDownloadUrl}`;
  // WebCal URL format for Apple Calendar
  const webcalUrl = fullIcsUrl.replace(/^https?:\/\//, 'webcal://');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullIcsUrl);
    setCopied(true);
    showToast('Calendar subscription link copied!');
    setTimeout(() => setCopied(false), 2500);
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
                Sync with Your External Calendar
              </h2>
              <p className="text-xs text-zinc-500">
                Apple Calendar, Google Calendar, and Microsoft Outlook
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
            Never miss an invoice due date! Subscribe or export your wallet&apos;s bills directly into your personal calendar with automatic 1-day and 3-day reminder notifications.
          </p>

          {/* Option 1: Direct Download .ics & Direct WebCal */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  1. One-Click Subscribe or Download
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Direct import into Apple Calendar or download static .ICS file
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={webcalUrl}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-indigo-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Subscribe</span>
                </a>
                <a
                  href={icsDownloadUrl}
                  download={`${walletData.wallet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-bills.ics`}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.ICS File</span>
                </a>
              </div>
            </div>
          </div>

          {/* Option 2: Live Subscription Link */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-900 dark:text-white mb-1">
              2. Live Calendar Feed Subscription URL
            </p>
            <p className="text-[11px] text-zinc-500 mb-2">
              Automatically updates when you add new invoices or mark them as paid.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullIcsUrl}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 text-xs font-mono text-zinc-800 dark:text-zinc-300 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Feed'}</span>
              </button>
            </div>
          </div>

          {/* Instructions Accordion / Guide */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1.5 text-zinc-700 dark:text-zinc-300">
            <p className="font-bold text-indigo-900 dark:text-indigo-300">
              How to add to Google Calendar or Apple Calendar:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              <li><strong>Apple Calendar (Mac/iPhone):</strong> File → New Calendar Subscription → Paste feed link.</li>
              <li><strong>Google Calendar:</strong> Other calendars (+) → &quot;From URL&quot; → Paste feed link.</li>
              <li><strong>Outlook:</strong> Add Calendar → &quot;Subscribe from web&quot; → Paste feed link.</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
