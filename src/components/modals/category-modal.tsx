'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={() => !isSubmitting && onClose()} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 transition-colors"
              style={{ backgroundColor: color }}
            >
              {React.createElement(getCategoryIcon(icon), { className: 'w-4 h-4' })}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {isEdit ? t('categories.edit') : t('categories.add')}
              </h2>
              <p className="text-xs text-zinc-500">
                {t('categories.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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

          {/* Color Swatches */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('categories.colorLabel')}
            </label>
            <div
              role="radiogroup"
              aria-label={t('categories.colorLabel')}
              className="flex items-center gap-2.5 flex-wrap pt-1"
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
                    className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                      isSelected
                        ? 'scale-125 ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-900 shadow-xs'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          </div>

          {/* Icon Picker Grid */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('categories.iconLabel')}
            </label>
            <div className="grid grid-cols-7 gap-2 p-2 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/30">
              {Object.entries(CATEGORY_ICONS).map(([iconName, IconComponent]) => {
                const isSelected = icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    disabled={isSubmitting}
                    className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {t('categories.limitLabel')} ({currency})
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noLimit}
                  onChange={(e) => {
                    setNoLimit(e.target.checked);
                    if (e.target.checked) setMonthlyLimit('');
                  }}
                  disabled={isSubmitting}
                  className="rounded-md border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors disabled:opacity-50"
            >
              {t('categories.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('categories.saving') : t('categories.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
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
