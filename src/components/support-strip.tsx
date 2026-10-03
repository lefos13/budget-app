'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { SupportLinkButtons } from '@/components/support/support-link-buttons';

export function SupportStrip() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {t('support.stripText')}
      </p>
      <SupportLinkButtons variant="subtle" />
    </div>
  );
}
