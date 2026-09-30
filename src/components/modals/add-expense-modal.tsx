'use client';

import React, { useState } from 'react';
import { X, Receipt, CalendarClock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';
import { toDateKey, isCurrentMonthKey, parseMonthKey } from '@/lib/month';
import { canLinkToSavings } from '@/lib/savings';
import { useSavings } from '@/components/savings/use-savings';
import { useDisposition, type DispositionChoice } from '@/components/savings/disposition-modal';

const NEW_BUCKET = '__new__';

export function AddExpenseModal() {
  const { isAddExpenseOpen } = useApp();
  if (!isAddExpenseOpen) return null;
  return <AddExpenseModalDialog />;
}

function AddExpenseModalDialog() {
  const {
    setIsAddExpenseOpen,
    activeWalletId,
    walletData,
    currentUser,
    modalInitialDate,
    modalInitialExpenseKind,
    editingExpense,
    editingPlannedExpense,
    selectedMonth,
    refreshWallet,
    showToast,
  } = useApp();
  const { t } = useTranslation();
  const { data: savings, staleData: staleSavings } = useSavings();
  const disposition = useDisposition((savings ?? staleSavings)?.buckets ?? []);
  const [savingsChoice, setSavingsChoice] = useState('');
  // null = follow the expense title until the user types their own bucket name.
  const [newBucketName, setNewBucketName] = useState<string | null>(null);

  const isEditExpense = Boolean(editingExpense);
  const isEditPlanned = Boolean(editingPlannedExpense);
  const isEdit = isEditExpense || isEditPlanned;

  const [kind, setKind] = useState<'ACTUAL' | 'PLANNED'>(() => {
    if (editingExpense) return 'ACTUAL';
    if (editingPlannedExpense) return 'PLANNED';
    return modalInitialExpenseKind ?? 'ACTUAL';
  });
  const [title, setTitle] = useState(() => {
    if (editingExpense) return editingExpense.title;
    if (editingPlannedExpense) return editingPlannedExpense.title;
    return '';
  });
  const [amount, setAmount] = useState(() => {
    if (editingExpense) return String(editingExpense.amount);
    if (editingPlannedExpense) return String(editingPlannedExpense.amount);
    return '';
  });
  const [categoryId, setCategoryId] = useState(() => {
    if (editingExpense) return editingExpense.categoryId ?? '';
    if (editingPlannedExpense) return editingPlannedExpense.categoryId ?? '';
    return '';
  });
  const [date, setDate] = useState(() => {
    if (editingExpense) return toDateKey(new Date(editingExpense.date));
    if (editingPlannedExpense) return new Date(editingPlannedExpense.expectedDate).toISOString().slice(0, 10);
    if (modalInitialDate) return modalInitialDate;
    const initialKind = modalInitialExpenseKind ?? 'ACTUAL';
    if (initialKind === 'PLANNED') {
      if (!isCurrentMonthKey(selectedMonth)) {
        const parsed = parseMonthKey(selectedMonth);
        if (parsed) {
          return toDateKey(new Date(parsed.year, parsed.monthIndex, 1));
        }
      }
    }
    return toDateKey(new Date());
  });
  const [notes, setNotes] = useState(() => {
    if (editingExpense) return editingExpense.notes ?? '';
    if (editingPlannedExpense) return editingPlannedExpense.notes ?? '';
    return '';
  });
  const [isRecurring, setIsRecurring] = useState(() => {
    if (editingExpense) return editingExpense.isRecurring;
    return false;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleKindChange = (newKind: 'ACTUAL' | 'PLANNED') => {
    if (isEdit) return;
    setKind(newKind);
    setErrorMessage(null);
    if (newKind === 'PLANNED' && !modalInitialDate) {
      if (!isCurrentMonthKey(selectedMonth)) {
        const parsed = parseMonthKey(selectedMonth);
        if (parsed) {
          setDate(toDateKey(new Date(parsed.year, parsed.monthIndex, 1)));
        }
      }
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) setIsAddExpenseOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, setIsAddExpenseOpen]);

  // Parse the YYYY-MM-DD input as local noon so the month is the one the user picked.
  const showSavingsChoice =
    kind === 'PLANNED' && !isEdit && Boolean(date) && canLinkToSavings(new Date(`${date}T12:00:00`));
  // Editing a linked expense's date into the current/past month unlinks it from its bucket (server-side).
  const willUnlinkFromSavings =
    isEditPlanned &&
    Boolean(editingPlannedExpense?.savingsBucketId) &&
    Boolean(date) &&
    !canLinkToSavings(new Date(`${date}T12:00:00`));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    if (!isEdit && !activeWalletId) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (isEditExpense && editingExpense) {
        const res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
          },
          body: JSON.stringify({
            title: title.trim(),
            amount: parseFloat(amount),
            date,
            categoryId: categoryId || null,
            notes: notes.trim() || null,
            isRecurring,
          }),
        });

        if (res.ok) {
          showToast(t('expenseEdit.updatedToast').replace('{title}', title.trim()));
          setIsAddExpenseOpen(false);
          await refreshWallet();
        } else {
          if (res.status === 403) {
            setErrorMessage(t('expenseEdit.errorForbidden'));
          } else if (res.status === 409) {
            setErrorMessage(t('expenseEdit.errorLocked'));
          } else if (res.status === 400) {
            setErrorMessage(t('expenseEdit.errorInvalid'));
          } else {
            setErrorMessage(t('expenseEdit.errorGeneric'));
          }
        }
      } else if (isEditPlanned && editingPlannedExpense) {
        const patchPlanned = async (choice?: DispositionChoice): Promise<boolean> => {
          const res = await fetch(`/api/planned-expenses/${editingPlannedExpense.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
            },
            body: JSON.stringify({
              title: title.trim(),
              amount: parseFloat(amount),
              expectedDate: date,
              categoryId: categoryId || null,
              notes: notes.trim() || null,
              ...(choice ? { disposition: choice } : {}),
            }),
          });

          if (res.ok) {
            showToast(t('expenseEdit.updatedToast').replace('{title}', title.trim()));
            setIsAddExpenseOpen(false);
            await refreshWallet();
            return true;
          }
          const json = await res.json().catch(() => ({}));
          if (res.status === 409 && json?.error === 'Disposition required' && !choice) {
            // The date change unlinks the last expense of a bucket that still holds money.
            disposition.ask(json.bucketId, json.leftover, patchPlanned);
          } else if (res.status === 403) {
            setErrorMessage(t('expenseEdit.errorForbidden'));
          } else if (res.status === 409) {
            setErrorMessage(t('expenseEdit.errorLocked'));
          } else if (res.status === 400) {
            setErrorMessage(t('expenseEdit.errorInvalid'));
          } else {
            setErrorMessage(t('expenseEdit.errorGeneric'));
          }
          return false;
        };
        await patchPlanned();
      } else if (kind === 'PLANNED') {
        const res = await fetch('/api/planned-expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
          },
          body: JSON.stringify({
            walletId: activeWalletId,
            title: title.trim(),
            amount: parseFloat(amount),
            expectedDate: date,
            categoryId: categoryId || null,
            notes: notes.trim() || null,
          }),
        });

        if (res.ok) {
          showToast(t('planned.createdToast').replace('{title}', title.trim()));
          if (savingsChoice && showSavingsChoice) {
            const created = await res.json().catch(() => null);
            const plannedId: string | undefined = created?.plannedExpense?.id;
            if (plannedId) {
              const linkRes = await fetch(`/api/planned-expenses/${plannedId}/savings`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
                },
                body: JSON.stringify(
                  savingsChoice === NEW_BUCKET
                    ? { newBucket: { name: ((newBucketName ?? '').trim() || title.trim()).slice(0, 60) } }
                    : { bucketId: savingsChoice }
                ),
              });
              const linkJson = await linkRes.json().catch(() => ({}));
              showToast(
                linkRes.ok
                  ? interpolate(t('savings.linkedToast'), { title: title.trim(), bucket: linkJson.bucket?.name ?? '' })
                  : translateApiError(linkJson?.error, linkRes.status, t)
              );
            }
          }
          setIsAddExpenseOpen(false);
          await refreshWallet();
        } else {
          if (res.status === 403) {
            setErrorMessage(t('planned.errorForbidden'));
          } else if (res.status === 400) {
            setErrorMessage(t('planned.errorInvalid'));
          } else {
            setErrorMessage(t('planned.errorGeneric'));
          }
        }
      } else {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
          },
          body: JSON.stringify({
            walletId: activeWalletId,
            title: title.trim(),
            amount: parseFloat(amount),
            categoryId: categoryId || null,
            date: new Date(date).toISOString(),
            notes: notes.trim() || null,
            isRecurring,
          }),
        });

        if (res.ok) {
          showToast(interpolate(t('expenses.addedToast'), { title }));
          setIsAddExpenseOpen(false);
          setTitle('');
          setAmount('');
          setNotes('');
          await refreshWallet();
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(translateApiError(data.error, res.status, t));
        }
      }
    } catch (err) {
      console.error(isEdit ? 'Failed to update expense:' : 'Failed to create expense:', err);
      if (isEdit) {
        setErrorMessage(t('expenseEdit.errorGeneric'));
      } else if (kind === 'PLANNED') {
        setErrorMessage(t('planned.errorGeneric'));
      } else {
        setErrorMessage(translateApiError(undefined, undefined, t));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={() => !isSubmitting && setIsAddExpenseOpen(false)}
      />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 z-10 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                kind === 'PLANNED'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
              }`}
            >
              {kind === 'PLANNED' ? <CalendarClock className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {isEdit
                  ? isEditPlanned
                    ? t('expenseEdit.editPlannedTitle')
                    : t('expenseEdit.editTitle')
                  : kind === 'PLANNED'
                  ? t('planned.addModalTitle')
                  : t('actions.addExpense')}
              </h2>
              <p className="text-xs text-zinc-500">
                {isEdit
                  ? t('expenseEdit.editSubtitle')
                  : kind === 'PLANNED'
                  ? t('planned.addModalSubtitle')
                  : interpolate(t('expenses.recordPaymentIn'), {
                      wallet: walletData?.wallet.name || t('common.wallet'),
                    })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddExpenseOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Toggle: Spent / Planned (hidden when editing) */}
        {!isEdit && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleKindChange('ACTUAL')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  kind === 'ACTUAL'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {t('planned.toggleSpent')}
              </button>
              <button
                type="button"
                onClick={() => handleKindChange('PLANNED')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  kind === 'PLANNED'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {t('planned.togglePlanned')}
              </button>
            </div>

            {kind === 'PLANNED' && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 leading-relaxed">
                {t('planned.plannedHint')}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('expenses.titleMerchantLabel')}
            </label>
            <input
              type="text"
              required
              placeholder={t('expenses.expensePlaceholder')}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {interpolate(t('bills.amountWithCurrency'), {
                  currency: walletData?.wallet.currency || 'EUR',
                })}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {kind === 'PLANNED' ? `${t('planned.expectedDateLabel')} *` : t('expenses.dateLabel')}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('bills.categoryLabel')}
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('expenses.generalCategory')}</option>
              {walletData?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {showSavingsChoice && (
            <div>
              <label htmlFor="planned-savings-bucket" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('savings.bucketFieldLabel')}
              </label>
              <select
                id="planned-savings-bucket"
                value={savingsChoice}
                onChange={(e) => setSavingsChoice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">{t('savings.bucketNone')}</option>
                {((savings ?? staleSavings)?.buckets ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value={NEW_BUCKET}>{t('savings.newBucket')}</option>
              </select>
              {savingsChoice === NEW_BUCKET && (
                <div className="mt-2">
                  <label
                    htmlFor="planned-new-bucket-name"
                    className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1"
                  >
                    {t('savings.newBucketNameFor')}
                  </label>
                  <input
                    id="planned-new-bucket-name"
                    type="text"
                    maxLength={60}
                    value={newBucketName ?? title.slice(0, 60)}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('expenses.notesLabel')}
            </label>
            <input
              type="text"
              placeholder={t('expenses.notesPlaceholder')}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {kind === 'ACTUAL' && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="recurringExpense"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="recurringExpense" className="text-xs text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
                {t('expenses.recurringCheckbox')}
              </label>
            </div>
          )}

          {willUnlinkFromSavings && editingPlannedExpense?.savingsBucket && (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 leading-relaxed">
              {interpolate(t('savings.dateUnlinkWarning'), { bucket: editingPlannedExpense.savingsBucket.name })}
            </p>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                kind === 'PLANNED'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {isSubmitting
                ? isEdit
                  ? t('expenseEdit.savingChanges')
                  : t('common.saving')
                : isEdit
                ? t('expenseEdit.saveChanges')
                : kind === 'PLANNED'
                ? t('planned.submitButton')
                : t('actions.addExpense')}
            </button>
          </div>
        </form>
      </div>
      {disposition.element}
    </div>
  );
}
