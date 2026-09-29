'use client';

import React, { useState } from 'react';
import { X, FileText, Bell, Repeat, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';

export function AddInvoiceModal({ initialDate }: { initialDate?: string }) {
  const { isAddInvoiceOpen } = useApp();
  if (!isAddInvoiceOpen) return null;
  return <AddInvoiceModalDialog initialDate={initialDate} />;
}

function AddInvoiceModalDialog({ initialDate }: { initialDate?: string }) {
  const { t } = useTranslation();
  const {
    setIsAddInvoiceOpen,
    activeWalletId,
    walletData,
    currentUser,
    modalInitialDate,
    refreshWallet,
    showToast,
  } = useApp();

  const [type, setType] = useState<'BILL' | 'SUBSCRIPTION'>('BILL');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => modalInitialDate || initialDate || new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState('MONTHLY');
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) setIsAddInvoiceOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, setIsAddInvoiceOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !dueDate || !activeWalletId) return;

    try {
      setIsSubmitting(true);
      const isSub = type === 'SUBSCRIPTION';
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        body: JSON.stringify({
          walletId: activeWalletId,
          title: title.trim(),
          amount: parseFloat(amount),
          type,
          dueDate: new Date(dueDate).toISOString(),
          categoryId: categoryId || null,
          invoiceNumber: invoiceNumber.trim() || null,
          notes: notes.trim() || null,
          isRecurring: isSub ? true : isRecurring,
          recurrenceInterval: isSub ? recurrenceInterval : (isRecurring ? recurrenceInterval : 'NONE'),
          reminderDaysBefore: parseInt(reminderDaysBefore) || 3,
        }),
      });

      if (res.ok) {
        showToast(
          isSub
            ? `Added recurring subscription: "${title}"`
            : `Scheduled bill reminder: "${title}"`
        );
        setIsAddInvoiceOpen(false);
        setTitle('');
        setAmount('');
        setInvoiceNumber('');
        setNotes('');
        setType('BILL');
        await refreshWallet();
      }
    } catch (err) {
      console.error('Failed to create invoice:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={() => !isSubmitting && setIsAddInvoiceOpen(false)}
      />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              type === 'SUBSCRIPTION'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
            }`}>
              {type === 'SUBSCRIPTION' ? <Repeat className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {type === 'SUBSCRIPTION' ? t.bills.addSubscription : t.bills.addBillOrInvoice}
              </h2>
              <p className="text-xs text-zinc-500">
                {type === 'SUBSCRIPTION'
                  ? 'Track recurring subscriptions & monthly burn'
                  : 'Track due date and set calendar reminders'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddInvoiceOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Selector Toggle */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/70 rounded-xl">
          <button
            type="button"
            onClick={() => setType('BILL')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              type === 'BILL'
                ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.bills.bill}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setType('SUBSCRIPTION');
              setIsRecurring(true);
              if (recurrenceInterval === 'NONE') setRecurrenceInterval('MONTHLY');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              type === 'SUBSCRIPTION'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{t.bills.subscription}</span>
          </button>
        </div>

        {type === 'SUBSCRIPTION' && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 flex items-start gap-2 text-[11px] text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <span>{t.bills.subscriptionsNote}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {type === 'SUBSCRIPTION' ? 'Subscription Name *' : `${t.bills.billTitleLabel} *`}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'SUBSCRIPTION' ? 'e.g. Netflix 4K, Spotify Family, Gym, iCloud' : 'e.g. Electricity Power Bill, Internet Fiber, Landlord Rent'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Amount ({walletData?.wallet.currency || 'EUR'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="">General</option>
                {walletData?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Invoice Reference #
              </label>
              <input
                type="text"
                placeholder="INV-2026-09"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Reminder & Recurrence Settings */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Alert me beforehand:</span>
              </div>
              <select
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-800 dark:text-zinc-200"
              >
                <option value="1">1 day before</option>
                <option value="3">3 days before</option>
                <option value="5">5 days before</option>
                <option value="7">1 week before</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
              <label htmlFor="recurringBill" className="flex items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                <span>Repeats periodically</span>
              </label>
              <input
                type="checkbox"
                id="recurringBill"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
              />
            </div>

            {isRecurring && (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-zinc-500">Recurrence:</span>
                <select
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(e.target.value)}
                  className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Payment Instructions / Notes (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. IBAN details, RF payment code, or card reference"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsAddInvoiceOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'SUBSCRIPTION'
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              }`}
            >
              {isSubmitting
                ? t.common.saving
                : type === 'SUBSCRIPTION'
                ? t.bills.addSubscription
                : t.bills.addBillOrInvoice}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
