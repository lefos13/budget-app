'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useApp, CategoryWithSpent } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { CATEGORY_ICONS, getCategoryIcon } from '@/lib/category-icons';

export interface CategoryModalProps {
  open: boolean;
  category: CategoryWithSpent | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
];

function CategoryModalDialog({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryWithSpent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { activeWalletId, currentUser, refreshWallet, showToast, walletData } = useApp();
  const { t } = useTranslation();

  const currency = walletData?.wallet?.currency || 'EUR';

  const [name, setName] = useState(() => category?.name ?? '');
  const [color, setColor] = useState(() => category?.color ?? '#3b82f6');
  const [icon, setIcon] = useState(() => category?.icon ?? 'Tag');
  const [monthlyLimit, setMonthlyLimit] = useState(() =>
    category?.monthlyLimit != null ? String(category.monthlyLimit) : ''
  );
  const [noLimit, setNoLimit] = useState(() =>
    category ? category.monthlyLimit === null : false
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWalletId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let finalLimit: number | null = null;
      if (!noLimit) {
        if (monthlyLimit.trim() === '') {
          setError(t('categories.errorInvalid'));
          setIsSubmitting(false);
          return;
        }
        const parsed = parseFloat(monthlyLimit);
        if (isNaN(parsed) || parsed < 0) {
          setError(t('categories.errorInvalid'));
          setIsSubmitting(false);
          return;
        }
        finalLimit = parsed;
      }

      const payload = {
        name: name.trim(),
        color,
        icon,
        monthlyLimit: finalLimit,
      };

      const url = isEdit
        ? `/api/wallets/${activeWalletId}/categories/${category!.id}`
        : `/api/wallets/${activeWalletId}/categories`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await refreshWallet();
        showToast(isEdit ? t('categories.updatedToast') : t('categories.createdToast'));
        onSaved();
        onClose();
      } else {
        if (res.status === 409) {
          setError(t('categories.errorDuplicate'));
        } else if (res.status === 400) {
          setError(t('categories.errorInvalid'));
        } else if (res.status === 403) {
          setError(t('categories.errorForbidden'));
        } else {
          setError(t('categories.errorGeneric'));
        }
      }
    } catch (err) {
      console.error('Failed to save category:', err);
      setError(t('categories.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      onClose={onClose}
      dismissible={!isSubmitting}
      onSubmit={handleSubmit}
      title={isEdit ? t('categories.edit') : t('categories.add')}
      description={t('categories.subtitle')}
      icon={
        // Live preview of the chosen colour + icon doubles as the dialog icon.
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 transition-colors"
          style={{ backgroundColor: color }}
        >
          {React.createElement(getCategoryIcon(icon), { className: 'w-4 h-4' })}
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-sm sm:text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-50"
          >
            {t('categories.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('categories.saving') : t('categories.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Inline Error Message */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}

        {/* Name Input */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            {t('categories.nameLabel')} *
          </label>
          <input
            type="text"
            required
            maxLength={40}
            placeholder={t('categories.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        {/* Color Swatches: 44px hit area on phones, swatch itself stays 28px */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            {t('categories.colorLabel')}
          </label>
          <div
            role="radiogroup"
            aria-label={t('categories.colorLabel')}
            className="flex items-center gap-x-1 gap-y-1 flex-wrap"
          >
            {PRESET_COLORS.map((c) => {
              const isSelected = color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  disabled={isSubmitting}
                  className="flex size-11 sm:size-7 items-center justify-center rounded-full cursor-pointer disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={`block size-7 sm:size-full rounded-full shadow-xs transition-transform ${
                      isSelected
                        ? 'scale-110 ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-900'
                        : 'opacity-80 hover:scale-110 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Picker Grid: five columns on phones so each tile keeps a >40px hit area */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            {t('categories.iconLabel')}
          </label>
          <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 p-2 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/30">
            {Object.entries(CATEGORY_ICONS).map(([iconName, IconComponent]) => {
              const isSelected = icon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  disabled={isSubmitting}
                  className={`min-h-11 sm:min-h-0 p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs ring-2 ring-zinc-900 dark:ring-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                  aria-label={iconName}
                  title={iconName}
                >
                  <IconComponent className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Monthly Limit & No Limit Checkbox */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t('categories.limitLabel')} ({currency})
            </label>
            <label className="flex items-center gap-1.5 min-h-11 sm:min-h-0 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noLimit}
                onChange={(e) => {
                  setNoLimit(e.target.checked);
                  if (e.target.checked) setMonthlyLimit('');
                }}
                disabled={isSubmitting}
                className="rounded-md border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 sm:w-3.5 sm:h-3.5"
              />
              <span>{t('categories.noLimitCheckbox')}</span>
            </label>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            required={!noLimit}
            disabled={noLimit || isSubmitting}
            placeholder={noLimit ? t('categories.noLimit') : '0.00'}
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </Dialog>
  );
}

export function CategoryModal({ open, category, onClose, onSaved }: CategoryModalProps) {
  if (!open) return null;

  return (
    <CategoryModalDialog
      key={category ? category.id : 'new'}
      category={category}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
