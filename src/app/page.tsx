'use client';

import React from 'react';
import {
  Receipt,
  FileText,
  UserPlus,
  Layers,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';
import { isLandingView } from '@/lib/navigation';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { BudgetOverviewCard } from '@/components/budget-overview-card';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { UpcomingBillsCard } from '@/components/upcoming-bills-card';
import { RecentExpensesCard } from '@/components/recent-expenses-card';
import { PendingInvitesBanner } from '@/components/pending-invites-banner';
import { PasskeySetupPrompt } from '@/components/passkey-setup-prompt';
import { MonthProjectionCard } from '@/components/month-projection-card';
import { MonthlySavingsCard } from '@/components/savings/monthly-savings-card';
import { SupportStrip } from '@/components/support-strip';

function Dashboard() {
  const {
    currentUser,
    walletData,
    isLoading,
    setIsAddExpenseOpen,
    openAddInvoice,
    setIsInviteOpen,
    setIsNewWalletOpen,
  } = useApp();
  const { t } = useTranslation();

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-zinc-500">{t.dashboard.loadingFinances}</p>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-12 px-4">
        <PendingInvitesBanner />
        <PasskeySetupPrompt />
        <div className="text-center py-10 px-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-200/80 dark:border-indigo-800 shadow-md">
            <Layers className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            {t.dashboard.welcomeTitle}
          </h1>
          <p className="text-sm text-zinc-500 mt-2.5 mb-6 max-w-md mx-auto leading-relaxed">
            {t.dashboard.welcomeSubtitle}
          </p>
          <button
            type="button"
            onClick={() => setIsNewWalletOpen(true)}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            {t.dashboard.createFirstWallet}
          </button>
        </div>
      </div>
    );
  }

  const isSwitching = isLoading && Boolean(walletData);

  return (
    <div className={`space-y-7 transition-opacity ${isSwitching ? 'opacity-60' : ''}`} aria-busy={isSwitching}>
      {/* Targeted Pending Invites Banner */}
      <PendingInvitesBanner />

      {/* Passkey Setup Prompt */}
      <PasskeySetupPrompt />

      {/* Top Welcome & Wallet Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-500">
              {t.dashboard.activeAs} <strong className="text-zinc-800 dark:text-zinc-200">{currentUser?.name}</strong> ({t.roles[walletData.userRole as keyof typeof t.roles] ?? walletData.userRole})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0"
              style={{ backgroundColor: walletData.wallet.color }}
            />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              {walletData.wallet.name}
            </h1>
          </div>
        </div>

        {/* Action Controls & Collaborators stack */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Member avatars preview */}
          <div className="flex items-center -space-x-2 mr-1">
            {walletData.wallet.members?.slice(0, 3).map((m) => (
              <div key={m.id} className="relative group" title={`${m.user?.name} (${t.roles[m.role as keyof typeof t.roles] ?? m.role})`}>
                {m.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.user.avatarUrl}
                    alt={m.user.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900 shadow-xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-xs font-bold">
                    {m.user?.name?.slice(0, 1)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold transition-all shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t.actions.invite}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddExpenseOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{t.dashboard.addExpenseBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => openAddInvoice(undefined, 'BILL')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs shadow-amber-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.dashboard.addBillBtn}</span>
          </button>
        </div>
      </div>

      {/* Monthly Budget Overview Gauge */}
      <BudgetOverviewCard />

      {/* "If everything is paid" Month Projection */}
      <MonthProjectionCard />

      {/* Savings contributions for this month (hidden when there are no buckets) */}
      <MonthlySavingsCard />

      {/* Main Grid: Upcoming Invoices & Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        <UpcomingBillsCard />
        <RecentExpensesCard />
      </div>

      {/* Category Limits & Envelopes Breakdown */}
      <CategoryBreakdown />

      <SupportStrip />
    </div>
  );
}

export default function HomePage() {
  const pathname = usePathname();
  const { authMode, isAuthLoading, currentUser } = useApp();
  if (isLandingView({ pathname, authMode, isAuthLoading, hasUser: !!currentUser })) {
    return <LandingPage />;
  }
  return <Dashboard />;
}
