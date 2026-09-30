'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileJson,
  AlertCircle,
  Receipt,
  Tag,
  Calendar,
  Sparkles,
  TrendingUp,
  History,
  CheckCircle2,
  PiggyBank,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { translateApiError } from '@/lib/i18n/api-errors';

interface ImportPreviewData {
  wallet?: { name?: string; currency?: string };
  categories?: Array<unknown>;
  expenses?: Array<unknown>;
  invoices?: Array<unknown>;
  plannedExpenses?: Array<unknown>;
  activityLogs?: Array<unknown>;
  savingsBuckets?: Array<{ kind?: string }>;
}

interface ImportResultCounts {
  categories: number;
  expenses: number;
  invoices: number;
  plannedExpenses: number;
  history: number;
  savingsBuckets: number;
}

interface ImportWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportWalletModal({ isOpen, onClose }: ImportWalletModalProps) {
  if (!isOpen) return null;
  return <ImportWalletModalDialog onClose={onClose} />;
}

function ImportWalletModalDialog({ onClose }: { onClose: () => void }) {
  const { activeWalletId, walletData, currentUser, refreshWallet, showToast } = useApp();
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultCounts | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImporting, onClose]);

  if (!walletData) return null;

  const processFile = (file: File) => {
    setImportResult(null);
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError(t('importModal.selectJsonFile'));
      setSelectedFile(null);
      setParsedData(null);
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        if (!json || typeof json !== 'object') {
          setError(t('importModal.invalidJson'));
          setParsedData(null);
          return;
        }

        setParsedData(json);
      } catch {
        setError(t('importModal.invalidJson'));
        setParsedData(null);
      }
    };
    reader.onerror = () => {
      setError(t('importModal.readError'));
      setParsedData(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async () => {
    if (!parsedData || !activeWalletId) return;

    try {
      setIsImporting(true);
      setError(null);

      const res = await fetch(`/api/wallets/${activeWalletId}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser.id } : {}),
        },
        body: JSON.stringify(parsedData),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(translateApiError(result.error, res.status, t));
      } else {
        const imported: ImportResultCounts = {
          categories: result.imported?.categories || 0,
          expenses: result.imported?.expenses || 0,
          invoices: result.imported?.invoices || 0,
          plannedExpenses: result.imported?.plannedExpenses || 0,
          history: result.imported?.history || result.imported?.activityLogs || 0,
          savingsBuckets: result.imported?.savingsBuckets || 0,
        };
        setImportResult(imported);
        showToast(
          interpolate(t('importModal.importedToast'), {
            expenses: imported.expenses,
            invoices: imported.invoices,
          })
        );
        await refreshWallet();
      }
    } catch (err) {
      console.error('Error importing wallet data:', err);
      setError(t('importModal.unexpectedError'));
    } finally {
      setIsImporting(false);
    }
  };

  const categoriesCount = parsedData?.categories?.length || 0;
  const expensesCount = parsedData?.expenses?.length || 0;
  const billsCount = parsedData?.invoices?.length || 0;
  const plannedCount = parsedData?.plannedExpenses?.length || 0;
  const historyCount = parsedData?.activityLogs?.length || 0;
  const savingsBucketCount = (parsedData?.savingsBuckets ?? []).filter((b) => b?.kind !== 'GENERAL').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={() => !isImporting && onClose()} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 z-10 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/50 shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {t('importModal.title')}
              </h2>
              <p className="text-xs text-zinc-500">{t('importModal.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Import Result Panel */}
        {importResult ? (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    {t('importModal.resultTitle')}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t('importModal.resultSubtitle')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                  <Tag className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                    {importResult.categories}
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.categories')}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                  <Receipt className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                    {importResult.expenses}
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.expenses')}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                  <Calendar className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                    {importResult.invoices}
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.billsAndSubs')}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                  <TrendingUp className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                  <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                    {importResult.plannedExpenses}
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.plannedExpenses')}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                  <History className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                  <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                    {importResult.history}
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.history')}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                  <PiggyBank className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                    {importResult.savingsBuckets}
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.savingsBuckets')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
              >
                {t('common.done')}
              </button>
            </div>
          </div>
        ) : (
          /* File Upload & Preview Panel */
          <div className="mt-5 space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-950/40'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <FileJson className="w-10 h-10 text-indigo-500 mx-auto mb-2.5" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {t('importModal.dragDropText')}{' '}
                <span className="text-indigo-600 dark:text-indigo-400 underline">
                  {t('importModal.browseFiles')}
                </span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">{t('importModal.supportsFormat')}</p>
            </div>

            {selectedFile && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileJson className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {interpolate(t('importModal.fileSizeKb'), {
                      size: (selectedFile.size / 1024).toFixed(1),
                    })}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                  {t('importModal.ready')}
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Data Preview */}
            {parsedData && (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    {t('importModal.previewTitle')}
                  </p>
                  <span className="text-[11px] text-zinc-500">
                    {t('importModal.targetLabel')} <strong>{walletData.wallet.name}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                    <Tag className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      {categoriesCount}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.categories')}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                    <Receipt className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      {expensesCount}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.expenses')}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                    <Calendar className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      {billsCount}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.billsAndSubs')}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                    <TrendingUp className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                    <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      {plannedCount}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.plannedExpenses')}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                    <History className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                    <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      {historyCount}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.history')}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
                    <PiggyBank className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-base font-black text-zinc-900 dark:text-white tabular-nums">
                      {savingsBucketCount}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-tight">{t('importModal.savingsBuckets')}</p>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
                  {t('importModal.overwriteNotice')}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={isImporting || !parsedData}
                onClick={handleImportSubmit}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isImporting ? t('importModal.importing') : t('importModal.importButton')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
