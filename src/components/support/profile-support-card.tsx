'use client';

import React from 'react';
import { HeartHandshake } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { SupportLinkButtons } from '@/components/support/support-link-buttons';

export function ProfileSupportCard() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="profile-support-title"
      className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5"
    >
      <div>
        <h2
          id="profile-support-title"
          className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2"
        >
          <HeartHandshake className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          <span>{t('support.profileTitle')}</span>
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {t('support.profileSubtitle')}
        </p>
      </div>

      <SupportLinkButtons variant="subtle" />
    </section>
  );
}
