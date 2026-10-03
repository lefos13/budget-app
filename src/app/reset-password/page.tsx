'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet, Lock, ArrowRight, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { translateApiError } from '@/lib/i18n/api-errors';
import { safeNextPath, authHref } from '@/lib/navigation';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const next = searchParams.get('next');

  const { setCurrentUser, setAuthMode, refreshWallets, showToast } = useApp();
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInvalidToken, setIsInvalidToken] = useState(!token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setIsInvalidToken(true);
      return;
    }

    if (!password || password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 &&
          (data.error === 'This reset link is invalid or has expired' ||
            data.error?.toLowerCase().includes('expired') ||
            data.error?.toLowerCase().includes('invalid'))
        ) {
          setIsInvalidToken(true);
          return;
        }
        setError(translateApiError(data.error, res.status, t));
        return;
      }

      setAuthMode('normal');
      setCurrentUser(data.user);
      await refreshWallets();
      showToast(t('auth.passwordResetSuccess'));
      router.replace(safeNextPath(next));
    } catch (err) {
      console.error('Password reset submit error:', err);
      setError(t('errors.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                  Aura
                </span>
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
                  {t('brand.badge')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {t('brand.subtitle')}
              </p>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {t('auth.resetPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t('auth.resetPasswordSubtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-zinc-900/5">
          {isInvalidToken ? (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {t('auth.invalidResetLinkTitle')}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t('auth.invalidResetLinkDesc')}
              </p>
              <div className="pt-4 space-y-3">
                <Link
                  href={authHref('forgot-password', next)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>{t('auth.requestNewLink')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={authHref('login', next)}
                  className="block text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline"
                >
                  {t('auth.backToSignIn')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-400 text-xs sm:text-sm font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
                  >
                    {t('auth.newPassword')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
                  >
                    {t('auth.confirmNewPassword')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('auth.resettingPassword')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('auth.resetPasswordAction')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-center text-xs">
                <Link
                  href={authHref('login', next)}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t('auth.backToSignIn')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
