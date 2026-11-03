'use client';

import React, { useCallback, useState } from 'react';
import { Landmark, PiggyBank } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { formatCurrency } from '@/lib/formatters';
import type { SavingsBucketView } from './use-savings';

export type DispositionChoice = { type: 'GENERAL' } | { type: 'BUCKET'; targetBucketId: string };

interface DispositionModalProps {
  bucketName: string;
  leftover: number;
  /** Active sub-buckets the leftover can go to (the closing bucket excluded). */
  targets: Array<{ id: string; name: string }>;
  onConfirm: (choice: DispositionChoice) => Promise<void>;
  onClose: () => void;
}

/** Asks where a closing bucket's leftover goes: General savings or another bucket (never the budget). */
export function DispositionModal({ bucketName, leftover, targets, onConfirm, onClose }: DispositionModalProps) {
  const { walletData } = useApp();
  const { t } = useTranslation();
  const currency = walletData?.wallet.currency || 'EUR';
  const [type, setType] = useState<'GENERAL' | 'BUCKET'>('GENERAL');
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(type === 'GENERAL' ? { type: 'GENERAL' } : { type: 'BUCKET', targetBucketId: targetId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const optionClass = (active: boolean) =>
    `flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
      active
        ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30'
        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
    }`;

  return (
    // Stacked: it opens on top of the dialog that hit "409 Disposition required".
    <Dialog
      onClose={onClose}
      size="sm"
      stacked
      dismissible={!isSubmitting}
      onSubmit={submit}
      title={t('savings.dispositionTitle')}
      description={interpolate(t('savings.dispositionSubtitle'), {
        bucket: bucketName,
        amount: formatCurrency(leftover, currency),
      })}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-sm sm:text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (type === 'BUCKET' && !targetId)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('common.processing') : t('savings.dispositionConfirm')}
          </button>
        </>
      }
    >
        <div className="space-y-3">
          <label className={optionClass(type === 'GENERAL')}>
            <input
              type="radio"
              name="disposition"
              checked={type === 'GENERAL'}
              onChange={() => setType('GENERAL')}
              className="accent-emerald-600"
            />
            <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="min-w-0 text-sm font-semibold text-zinc-900 dark:text-white break-words">{t('savings.dispositionGeneral')}</span>
          </label>
          <label className={`${optionClass(type === 'BUCKET')} ${targets.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="radio"
              name="disposition"
              disabled={targets.length === 0}
              checked={type === 'BUCKET'}
              onChange={() => setType('BUCKET')}
              className="accent-emerald-600"
            />
            <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="min-w-0 text-sm font-semibold text-zinc-900 dark:text-white break-words">{t('savings.dispositionOtherBucket')}</span>
          </label>
          {type === 'BUCKET' && targets.length > 0 && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              aria-label={t('savings.dispositionOtherBucket')}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {targets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

        </div>
    </Dialog>
  );
}
/**
 * Handles `409 Disposition required` from any savings-aware request: shows the modal, then re-sends the
 * request with the chosen disposition via `retry`. `retry` resolves true when the retried request succeeded.
 */
export function useDisposition(buckets: SavingsBucketView[]) {
  const [pending, setPending] = useState<{
    bucketId: string;
    leftover: number;
    retry: (choice: DispositionChoice) => Promise<boolean>;
  } | null>(null);

  const ask = useCallback(
    (bucketId: string, leftover: number, retry: (choice: DispositionChoice) => Promise<boolean>) =>
      setPending({ bucketId, leftover, retry }),
    []
  );

  const element = pending ? (
    <DispositionModal
      bucketName={buckets.find((b) => b.id === pending.bucketId)?.name ?? ''}
      leftover={pending.leftover}
      targets={buckets.filter((b) => b.id !== pending.bucketId).map((b) => ({ id: b.id, name: b.name }))}
      onClose={() => setPending(null)}
      onConfirm={async (choice) => {
        if (await pending.retry(choice)) setPending(null);
      }}
    />
  ) : null;

  return { ask, element };
}
