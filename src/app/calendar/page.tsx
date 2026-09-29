'use client';

import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  Repeat,
  FileText,
  Layers,
} from 'lucide-react';
import { MonthGrid } from '@/components/calendar/month-grid';
import { UrgentRemindersBanner } from '@/components/urgent-reminders-banner';
import { SubscriptionsSection } from '@/components/calendar/subscriptions-section';
import { BillsListView } from '@/components/calendar/bills-list-view';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';

export default function CalendarPage() {
  const { isLoading, walletData, setIsAddInvoiceOpen } = useApp();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'ALL' | 'BILL' | 'SUBSCRIPTION'>('ALL');
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');

  if (isLoading && !walletData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-500">{t('common.loading')}</p>
      </div>
    );
  }

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
                Track due dates, recurring subscriptions, burn rate & RFC 5545 export
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsAddInvoiceOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{t('bills.addSubscription')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddInvoiceOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('bills.addBillOrInvoice')}</span>
          </button>
        </div>
      </div>

      {/* View Selector Tabs and Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-zinc-100/80 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/70 dark:border-zinc-800">
        {/* Category Tabs: All, Bills & Invoices, Subscriptions */}
        <div className="flex items-center gap-1">
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

        {/* View Switcher: Calendar View vs List View */}
        <div className="flex items-center gap-1 bg-white/70 dark:bg-zinc-950/60 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-800 self-start sm:self-auto">
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

      {/* Urgent Reminders Alerts */}
      <UrgentRemindersBanner />

      {/* Subscriptions Section & Burn Rate Metric Card */}
      {/* Shown prominently when Subscriptions tab is clicked or as recurring overview */}
      <SubscriptionsSection onAddSubscription={() => setIsAddInvoiceOpen(true)} />

      {/* Main View: Calendar MonthGrid OR List View */}
      {viewMode === 'CALENDAR' ? (
        <MonthGrid typeFilter={activeTab} />
      ) : (
        <BillsListView typeFilter={activeTab} />
      )}
    </div>
  );
}
