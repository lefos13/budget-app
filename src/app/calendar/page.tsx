'use client';

import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  Repeat,
  FileText,
  Layers,
  Download,
} from 'lucide-react';
import { MonthGrid } from '@/components/calendar/month-grid';
import { UrgentRemindersBanner } from '@/components/urgent-reminders-banner';
import { UnpaidBillsBanner } from '@/components/unpaid-bills-banner';
import { SubscriptionsSection } from '@/components/calendar/subscriptions-section';
import { BillsListView } from '@/components/calendar/bills-list-view';
import { MonthSwitcher } from '@/components/month-switcher';
import { IcsExportModal } from '@/components/calendar/ics-export-modal';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';

export default function CalendarPage() {
  const { isLoading, walletData, openAddInvoice } = useApp();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'ALL' | 'BILL' | 'SUBSCRIPTION'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('ALL');
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');
  const [isIcsModalOpen, setIsIcsModalOpen] = useState(false);

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-500">{t('common.loading')}</p>
      </div>
    );
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-100/80 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/70 dark:border-zinc-800">
      {/* Category Tabs: All, Bills & Invoices, Subscriptions */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ALL'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t('bills.allTab')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BILL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'BILL'
              ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t('bills.billsTab')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SUBSCRIPTION')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'SUBSCRIPTION'
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>{t('bills.subscriptionsTab')}</span>
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap items-center rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 p-1 text-xs">
        {(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === filter
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {filter === 'ALL'
              ? t('bills.statusAll')
              : filter === 'PENDING'
              ? t('bills.statusPending')
              : filter === 'OVERDUE'
              ? t('bills.statusOverdue')
              : t('bills.statusPaid')}
          </button>
        ))}
      </div>

      {/* Right: Month Switcher & View Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <MonthSwitcher />

        <div className="flex items-center gap-1 bg-white/70 dark:bg-zinc-950/60 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'CALENDAR'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{t('bills.calendarView')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'LIST'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>{t('bills.listView')}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Header Bar with Tabs and View Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/60 shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {t('bills.calendarTitle')}
              </h1>
              <p className="text-xs text-zinc-500">
                {t('bills.calendarSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openAddInvoice(undefined, 'SUBSCRIPTION')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{t('bills.addSubscription')}</span>
          </button>
          <button
            type="button"
            onClick={() => openAddInvoice(undefined, 'BILL')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('bills.addBillOrInvoice')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsIcsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title={t('bills.syncIcsTooltip')}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('bills.syncIcs')}</span>
          </button>
        </div>
      </div>

      {/* Urgent Reminders Alerts */}
      <UrgentRemindersBanner />

      {/* Unpaid Bills Banner for Selected Month */}
      <UnpaidBillsBanner />

      {/* Subscriptions Section & Burn Rate Metric Card */}
      {/* Shown prominently when Subscriptions tab is clicked or as recurring overview */}
      <SubscriptionsSection onAddSubscription={() => openAddInvoice(undefined, 'SUBSCRIPTION')} />

      {/* Main View: Calendar MonthGrid OR List View */}
      {viewMode === 'CALENDAR' ? (
        <MonthGrid
          typeFilter={activeTab}
          statusFilter={statusFilter}
          toolbar={toolbar}
        />
      ) : (
        <>
          {toolbar}
          <BillsListView
            typeFilter={activeTab}
            statusFilter={statusFilter}
          />
        </>
      )}

      {/* .ICS Export Modal */}
      <IcsExportModal
        isOpen={isIcsModalOpen}
        onClose={() => setIsIcsModalOpen(false)}
      />
    </div>
  );
}
