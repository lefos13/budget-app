'use client';

import React, { useState } from 'react';
import { X, FileText, Bell, Repeat, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { toDateKey } from '@/lib/month';

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
    modalInitialType,
    editingInvoice,
    refreshWallet,
    showToast,
  } = useApp();

  const isEdit = Boolean(editingInvoice);
  const isPaid = editingInvoice?.status === 'PAID';
  const isPaidNonSub = isPaid && editingInvoice?.type !== 'SUBSCRIPTION';

  const [type, setType] = useState<'BILL' | 'SUBSCRIPTION'>(() => {
    if (editingInvoice) {
      return editingInvoice.type?.toUpperCase() === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'BILL';
    }
    return modalInitialType ?? 'BILL';
  });
  const [title, setTitle] = useState(() => editingInvoice?.title ?? '');
  const [amount, setAmount] = useState(() => (editingInvoice ? String(editingInvoice.amount) : ''));
  const [dueDate, setDueDate] = useState(() => {
    if (editingInvoice) {
      return new Date(editingInvoice.dueDate).toISOString().slice(0, 10);
    }
    return modalInitialDate || initialDate || toDateKey(new Date());
  });
  const [categoryId, setCategoryId] = useState(() => editingInvoice?.categoryId ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(() => editingInvoice?.invoiceNumber ?? '');
  const [notes, setNotes] = useState(() => editingInvoice?.notes ?? '');
  const [isRecurring, setIsRecurring] = useState(() => {
    if (editingInvoice) {
      return editingInvoice.isRecurring;
    }
    return (modalInitialType ?? 'BILL') === 'SUBSCRIPTION';
  });
  const [recurrenceInterval, setRecurrenceInterval] = useState(() => editingInvoice?.recurrenceInterval || 'MONTHLY');
  const [reminderDaysBefore, setReminderDaysBefore] = useState(() => (editingInvoice ? String(editingInvoice.reminderDaysBefore) : '3'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) setIsAddInvoiceOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, setIsAddInvoiceOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !dueDate) return;
    if (!isEdit && !activeWalletId) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const isSub = type === 'SUBSCRIPTION';

      if (isEdit && editingInvoice) {
        const res = await fetch(`/api/invoices/${editingInvoice.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
          },
          body: JSON.stringify({
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
          showToast(interpolate(t('bills.updatedToast'), { title: title.trim() }));
          setIsAddInvoiceOpen(false);
          await refreshWallet();
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.error || t.bills.updateFailed);
        }
      } else {
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
              ? interpolate(t('bills.addedSubscriptionToast'), { title: title.trim() })
              : interpolate(t('bills.scheduledBillToast'), { title: title.trim() })
          );
          setIsAddInvoiceOpen(false);
          setTitle('');
          setAmount('');
          setInvoiceNumber('');
          setNotes('');
          setType('BILL');
          await refreshWallet();
        }
      }
    } catch (err) {
      console.error(isEdit ? 'Failed to update invoice:' : 'Failed to create invoice:', err);
      if (isEdit) {
        setErrorMessage(t.bills.updateFailed);
      }
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
                {isEdit
                  ? (type === 'SUBSCRIPTION' ? t.bills.editSubscriptionTitle : t.bills.editBillTitle)
                  : (type === 'SUBSCRIPTION' ? t.bills.addSubscription : t.bills.addBillOrInvoice)}
              </h2>
              <p className="text-xs text-zinc-500">
                {type === 'SUBSCRIPTION'
                  ? t('bills.subscriptionModalSubtitle')
                  : t('bills.billModalSubtitle')}
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
            disabled={isPaid}
            onClick={() => !isPaid && setType('BILL')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              isPaid ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
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
            disabled={isPaid}
            onClick={() => {
              if (isPaid) return;
              setType('SUBSCRIPTION');
              setIsRecurring(true);
              if (recurrenceInterval === 'NONE') setRecurrenceInterval('MONTHLY');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              isPaid ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
              type === 'SUBSCRIPTION'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{t.bills.subscription}</span>
          </button>
        </div>

        {isPaidNonSub && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>{t.bills.paidLockedHint}</span>
          </div>
        )}

        {type === 'SUBSCRIPTION' && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 flex items-start gap-2 text-[11px] text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <span>{t.bills.subscriptionsNote}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {type === 'SUBSCRIPTION' ? t('bills.subscriptionNameLabel') : t('bills.billTitleLabel')}
            </label>
            <input
              type="text"
              required
              placeholder={type === 'SUBSCRIPTION' ? t('bills.subscriptionPlaceholder') : t('bills.billPlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {interpolate(t('bills.amountWithCurrency'), { currency: walletData?.wallet.currency || 'EUR' })}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                disabled={isPaidNonSub}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('bills.dueDateRequired')}
              </label>
              <input
                type="date"
                required
                disabled={isPaidNonSub}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('bills.categoryLabel')}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="">{t('bills.generalCategory')}</option>
                {walletData?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('bills.invoiceNumberLabel')}
              </label>
              <input
                type="text"
                placeholder={t('bills.invoiceNumberPlaceholder')}
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
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{t('bills.reminderLabel')}</span>
              </div>
              <select
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-800 dark:text-zinc-200"
              >
                <option value="1">{t.bills.daysBefore['1']}</option>
                <option value="3">{t.bills.daysBefore['3']}</option>
                <option value="5">{t.bills.daysBefore['5']}</option>
                <option value="7">{t.bills.daysBefore['7']}</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
              <label htmlFor="recurringBill" className="flex items-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t('bills.recurrenceLabel')}</span>
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
                <span className="text-xs text-zinc-500">{t('bills.recurrenceColon')}</span>
                <select
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(e.target.value)}
                  className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="WEEKLY">{t.recurrence.WEEKLY}</option>
                  <option value="MONTHLY">{t.recurrence.MONTHLY}</option>
                  <option value="QUARTERLY">{t.recurrence.QUARTERLY}</option>
                  <option value="YEARLY">{t.recurrence.YEARLY}</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('bills.notesLabel')}
            </label>
            <input
              type="text"
              placeholder={t('bills.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            {errorMessage ? (
              <p className="text-xs text-rose-500 font-medium truncate max-w-[200px]" title={errorMessage}>
                {errorMessage}
              </p>
            ) : <div />}
            <div className="flex items-center gap-2">
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
                {isEdit
                  ? (isSubmitting ? t.bills.savingChanges : t.bills.saveChanges)
                  : (isSubmitting
                    ? t.common.saving
                    : type === 'SUBSCRIPTION'
                    ? t.bills.addSubscription
                    : t.bills.addBillOrInvoice)}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
