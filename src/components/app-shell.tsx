'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { isLandingView, isSplashView, isPublicChromeView } from '@/lib/navigation';
import { Sidebar } from '@/components/sidebar';
import { MonthContextBar } from '@/components/month-context-bar';
import { PublicHeader } from '@/components/public-header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authMode, isAuthLoading, currentUser } = useApp();
  const { t } = useTranslation();

  if (isLandingView({ pathname, authMode, isAuthLoading, hasUser: !!currentUser })) {
    return <>{children}</>;
  }

  if (isSplashView({ pathname, authMode, isAuthLoading })) {
    return (
      <div
        role="status"
        aria-label={t('landing.splashLabel')}
        className="min-h-screen flex flex-col items-center justify-center gap-5 bg-zinc-50 dark:bg-zinc-950"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25">
          <Wallet className="w-7 h-7" />
        </div>
        <div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPublicChromeView({ pathname, authMode, isAuthLoading, hasUser: !!currentUser })) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <PublicHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <MonthContextBar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
