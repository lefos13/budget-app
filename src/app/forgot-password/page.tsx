'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Wallet, Mail, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { interpolate } from '@/lib/i18n/translator';
import { authHref } from '@/lib/navigation';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const emailParam = searchParams.get('email');
  const { t, language } = useTranslation();

  const [email, setEmail] = useState(emailParam || '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t('auth.emailInvalid'));
      return;
    }

    try {
      setIsLoading(true);
      await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          language,
          next: next || undefined,
        }),
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Forgot password submit error:', err);
      setIsSubmitted(true);
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
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t('auth.forgotPasswordSubtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-zinc-900/5">
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-400 text-xs sm:text-sm font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isSubmitted ? (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {t('auth.resetLinkSentTitle')}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {interpolate(t('auth.resetLinkSentNotice'), { email: email.trim() })}
              </p>
              <div className="pt-4">
                <Link
                  href={authHref('login', next)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>{t('auth.backToSignIn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
                >
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
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
                    <span>{t('auth.sendingResetLink')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.sendResetLink')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {!isSubmitted && (
            <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500">{t('auth.rememberPassword')}</span>
              <Link
                href={authHref('login', next)}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('actions.signIn')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
