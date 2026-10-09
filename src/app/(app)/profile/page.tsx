'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  User as UserIcon,
  Mail,
  ImageIcon,
  Lock,
  AlertCircle,
  Loader2,
  Save,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { ProfileSupportCard } from '@/components/support/profile-support-card';
import { ProfilePasskeysCard } from '@/components/profile/profile-passkeys-card';

export default function ProfilePage() {
  const { currentUser, updateCurrentUser, refreshWallet, authMode, showToast, isLoading } = useApp();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  const lastUserIdRef = useRef<string | null>(null);

  // Synchronize inputs when currentUser loads or changes
  useEffect(() => {
    if (currentUser && currentUser.id !== lastUserIdRef.current) {
      lastUserIdRef.current = currentUser.id;
      setName(currentUser.name || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setFailedAvatarUrl(null);
    }
  }, [currentUser]);

  if (isLoading && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const validateUrl = (urlStr: string): boolean => {
    try {
      const parsed = new URL(urlStr);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t.profile.nameRequired);
      return;
    }

    if (trimmedName.length > 80) {
      setError(t.profile.nameMaxExceeded);
      return;
    }

    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar && !validateUrl(trimmedAvatar)) {
      setError(t.profile.invalidUrl);
      return;
    }

    // Password validation in normal mode
    if (authMode === 'normal' && (newPassword || currentPassword)) {
      if (!currentPassword) {
        setError(t.profile.currentPasswordRequired);
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setError(t.profile.passwordMinLength);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t.profile.passwordMismatch);
        return;
      }
    }

    try {
      setIsSaving(true);

      const body: {
        name: string;
        avatarUrl: string | null;
        currentPassword?: string;
        newPassword?: string;
      } = {
        name: trimmedName,
        avatarUrl: trimmedAvatar ? trimmedAvatar : null,
      };

      if (authMode === 'normal' && newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (currentUser.id) {
        headers['x-user-id'] = currentUser.id;
      }

      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'Current password is incorrect') {
          setError(t.profile.wrongCurrentPassword);
        } else if (data.error === 'Password must be at least 6 characters long') {
          setError(t.profile.passwordMinLength);
        } else if (data.error === 'Name is required' || data.error?.includes('Name')) {
          setError(t.profile.nameRequired);
        } else if (data.error?.includes('Avatar URL')) {
          setError(t.profile.invalidUrl);
        } else {
          setError(data.error || t.profile.genericError);
        }
        return;
      }

      updateCurrentUser(data.user);
      await refreshWallet();
      showToast(t.profile.savedToast);

      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(t.profile.genericError);
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (name.trim() || currentUser.name || 'U').slice(0, 2).toUpperCase();
  const trimmedAvatar = avatarUrl.trim();
  const hasValidAvatarPreview =
    trimmedAvatar && failedAvatarUrl !== trimmedAvatar && validateUrl(trimmedAvatar);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4 sm:px-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <UserIcon className="w-5 h-5" />
          </div>
          <span>{t.profile.title}</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {t.profile.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-400 text-sm font-medium animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile Card: Avatar + Basic Info */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Avatar Preview & Summary */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="shrink-0 relative">
              {hasValidAvatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trimmedAvatar}
                  alt={name || currentUser.name}
                  onError={() => setFailedAvatarUrl(trimmedAvatar)}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-indigo-500/20 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center ring-4 ring-indigo-500/20 shadow-md">
                  {initials}
                </div>
              )}
            </div>

            <div className="text-center sm:text-left min-w-0 flex-1">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white truncate">
                {name.trim() || currentUser.name}
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate">
                {currentUser.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{authMode === 'normal' ? t.devMode.normalMode : t.devMode.mockMode}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields: Name, Email, Avatar URL */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
              >
                {t.profile.nameLabel} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="profile-name"
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.profile.namePlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="profile-email"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  {t.profile.emailLabel}
                </label>
                <span className="text-[10px] text-zinc-400 italic">
                  {t.profile.emailHint}
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="profile-email"
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 text-sm cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Avatar URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="profile-avatar"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  {t.profile.avatarUrlLabel}
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <input
                  id="profile-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder={t.profile.avatarUrlPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                />
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                {t.profile.avatarUrlHint}
              </p>
            </div>
          </div>
        </div>

        {/* Password Section (Normal Mode) OR Mock Mode Note */}
        {authMode === 'normal' ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                <span>{t.profile.passwordSectionTitle}</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.profile.passwordSectionSubtitle}
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Current Password */}
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
                >
                  {t.profile.currentPasswordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t.profile.currentPasswordPlaceholder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                  />
                </div>
              </div>

              {/* New Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
                  >
                    {t.profile.newPasswordLabel}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t.profile.newPasswordPlaceholder}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
                  >
                    {t.profile.confirmPasswordLabel}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.profile.confirmPasswordPlaceholder}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-3xl p-5 flex items-start gap-3 text-amber-800 dark:text-amber-300">
            <Sparkles className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <div className="text-xs sm:text-sm">
              <p className="font-bold">{t.devMode.mockMode}</p>
              <p className="mt-1 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                {t.profile.mockModeNote}
              </p>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.profile.saving}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{t.profile.save}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {authMode === 'normal' && <ProfilePasskeysCard />}

      <ProfileSupportCard />
    </div>
  );
}
