'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  Calendar,
  CreditCard,
  Users,
  Plus,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Receipt,
  FileText,
  Layers,
  LogOut,
  Globe,
  Sparkles,
  Menu,
  X,
  UserCheck,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';

function subscribeSidebar(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSidebarSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('aura_sidebar_collapsed') === 'true';
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

export function Sidebar() {
  const pathname = usePathname();
  const {
    currentUser,
    users,
    setCurrentUser,
    wallets,
    activeWalletId,
    setActiveWalletId,
    walletData,
    authMode,
    setAuthMode,
    logout,
    openAddExpense,
    openAddInvoice,
    setIsNewWalletOpen,
  } = useApp();

  const { language, setLanguage, t } = useTranslation();

  const storeCollapsed = React.useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );
  const [activeCollapsed, setActiveCollapsed] = useState<boolean | null>(null);
  const isCollapsed = activeCollapsed ?? storeCollapsed;

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWalletDropdownOpen(false);
        setIsUserDropdownOpen(false);
        setIsAddMenuOpen(false);
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setActiveCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura_sidebar_collapsed', String(next));
      window.dispatchEvent(new Event('storage'));
    }
    setIsWalletDropdownOpen(false);
    setIsUserDropdownOpen(false);
    setIsAddMenuOpen(false);
  };

  // Hide sidebar on authentication pages
  const isAuthPage = pathname === '/login' || pathname === '/register';
  if (isAuthPage) {
    return null;
  }

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const overdueCount = walletData?.metrics?.overdueCount ?? 0;
  const remainingBudget = walletData?.metrics?.remainingBudget ?? activeWallet?.monthlyBudget ?? 0;

  const navLinks = [
    { href: '/', label: t.nav.overview, icon: Layers },
    { href: '/calendar', label: t.nav.calendar, icon: Calendar, badge: overdueCount },
    { href: '/expenses', label: t.nav.expenses, icon: CreditCard },
    { href: '/wallet', label: t.nav.walletTeam, icon: Users },
  ];

  return (
    <>
      {/* ---------------------------------------------------- */}
      {/* 1. Mobile Topbar (Sticky on Small Screens)            */}
      {/* ---------------------------------------------------- */}
      <header className="md:hidden sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-2xs">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-base font-extrabold tracking-tight">Aura</span>
        </Link>

        <div className="flex items-center gap-2">
          {activeWallet && (
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900 text-xs font-semibold max-w-[130px] truncate"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeWallet.color }}
              />
              <span className="truncate">{activeWallet.name}</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. Mobile Drawer / Sheet (Slide-over)                */}
      {/* ---------------------------------------------------- */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs animate-in fade-in"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-zinc-900 h-full p-5 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-md">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-base text-zinc-900 dark:text-white">Aura</span>
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {t.brand.badge}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wallet Switcher in Drawer */}
              <div className="mt-4">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  {t.wallet.yourWallets}
                </label>
                <div className="space-y-1">
                  {wallets.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setActiveWalletId(w.id);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs font-semibold ${
                        w.id === activeWalletId
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.color }} />
                        <span className="truncate">{w.name}</span>
                      </div>
                      {w.id === activeWalletId && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      setIsNewWalletOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-2 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.wallet.createNew}</span>
                  </button>
                </div>
              </div>

              {/* Navigation Links in Drawer */}
              <nav className="mt-6 space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Navigation
                </label>
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && item.badge > 0 ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>

              {/* Quick Actions in Drawer */}
              <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      openAddExpense();
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{t.actions.addExpense}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      openAddInvoice();
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t.actions.addBill}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Section in Drawer: Dev Mode, Language, Profile */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              {/* Language Switcher */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  {t.common.language}
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-400'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('el')}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      language === 'el'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-400'
                    }`}
                  >
                    EL
                  </button>
                </div>
              </div>

              {/* Dev Mode Switcher */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {authMode === 'mock' ? t.devMode.mockMode : t.devMode.normalMode}
                </span>
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'mock' ? 'normal' : 'mock')}
                  className="px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Toggle
                </button>
              </div>

              {/* Profile Card & Logout */}
              {currentUser && (
                <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {currentUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {currentUser.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">{currentUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    aria-label="Logout"
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. Modern Collapsible Sidebar for Desktop             */}
      {/* ---------------------------------------------------- */}
      <aside
        aria-label="Main sidebar"
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-30 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Top: Brand Header & Collapse Toggle */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-200/70 dark:border-zinc-800/70 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between w-full">
              <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-zinc-900 dark:text-white group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
                    Aura
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
                    {t.brand.badge}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={toggleCollapse}
                title={t.common.collapse}
                aria-label={t.common.collapse}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full gap-2">
              <button
                type="button"
                onClick={toggleCollapse}
                title={t.common.expand}
                aria-label={t.common.expand}
                className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Middle Container */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Active Wallet Switcher */}
          {!isCollapsed ? (
            <div className="relative">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-1">
                {t.wallet.selectWallet}
              </label>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isWalletDropdownOpen}
                onClick={() => {
                  setIsWalletDropdownOpen(!isWalletDropdownOpen);
                  setIsUserDropdownOpen(false);
                  setIsAddMenuOpen(false);
                }}
                className="w-full text-left p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/80 transition-all shadow-2xs cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: activeWallet?.color || '#6366f1' }}
                    />
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {activeWallet ? activeWallet.name : t.wallet.selectWallet}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
                </div>
                {activeWallet && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono">
                      {formatCurrency(remainingBudget, activeWallet.currency)} left
                    </span>
                    <span className="font-semibold text-zinc-400 uppercase text-[10px]">
                      {activeWallet.currency}
                    </span>
                  </div>
                )}
              </button>

              {/* Wallet Dropdown Menu */}
              {isWalletDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsWalletDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-30 py-2 animate-in fade-in zoom-in-95">
                    <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                      <span>{t.wallet.yourWallets}</span>
                      <span>{wallets.length}</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {wallets.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            setActiveWalletId(w.id);
                            setIsWalletDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                            w.id === activeWalletId
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                            <div className="truncate">
                              <p className="text-xs font-semibold truncate leading-tight">{w.name}</p>
                              <p className="text-[10px] text-zinc-400 truncate">{w.userRole}</p>
                            </div>
                          </div>
                          {w.id === activeWalletId && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsWalletDropdownOpen(false);
                        setIsNewWalletOpen(true);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1.5 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.wallet.createNew}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Collapsed: Dot indicator with tooltip
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleCollapse}
                title={`Active wallet: ${activeWallet?.name || 'None'}`}
                className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center transition-transform hover:scale-105"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shadow-xs ring-2 ring-white dark:ring-zinc-950"
                  style={{ backgroundColor: activeWallet?.color || '#6366f1' }}
                />
              </button>
            </div>
          )}

          {/* Quick Add Button */}
          {!isCollapsed ? (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isAddMenuOpen}
                onClick={() => {
                  setIsAddMenuOpen(!isAddMenuOpen);
                  setIsWalletDropdownOpen(false);
                  setIsUserDropdownOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.actions.add}</span>
                <ChevronDown className="w-3 h-3 text-indigo-200" />
              </button>

              {isAddMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsAddMenuOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        openAddExpense();
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-xs">{t.actions.addExpense}</p>
                        <p className="text-[10px] text-zinc-400">{t.actions.addExpenseSub}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        openAddInvoice();
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-bold text-xs">{t.actions.addBill}</p>
                        <p className="text-[10px] text-zinc-400">{t.actions.addBillSub}</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => openAddExpense()}
                title={t.actions.addExpense}
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 transition-transform hover:scale-105 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            {!isCollapsed && (
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block px-1 mb-1">
                Menu
              </label>
            )}
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                    isCollapsed ? 'justify-center px-0' : ''
                  } ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-white shadow-2xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white animate-pulse">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {isCollapsed && item.badge && item.badge > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Dev Mode Indicator & Toggle, Language Switcher, Profile */}
        <div className="p-3 border-t border-zinc-200/70 dark:border-zinc-800/70 shrink-0 space-y-2">
          {/* Dev Mode Switcher */}
          {!isCollapsed ? (
            <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      authMode === 'mock' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                    {authMode === 'mock' ? t.devMode.mockMode : t.devMode.normalMode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'mock' ? 'normal' : 'mock')}
                  className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Toggle
                </button>
              </div>

              {/* In Mock Mode: Quick simulated user switch button */}
              {authMode === 'mock' && (
                <div className="relative mt-1 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="w-full flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-amber-500" />
                      <span>{t.devMode.switchUser}</span>
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {isUserDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setIsUserDropdownOpen(false)} />
                      <div className="absolute left-0 bottom-full mb-2 w-56 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95">
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {t.devMode.title}
                        </div>
                        <div className="max-h-48 overflow-y-auto py-1">
                          {users.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setCurrentUser(u);
                                setIsUserDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                                u.id === currentUser?.id
                                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 font-semibold'
                                  : 'text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              <span className="truncate">{u.name}</span>
                              {u.id === currentUser?.id && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'mock' ? 'normal' : 'mock')}
                title={`Dev Mode: ${authMode}. Click to toggle.`}
                className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-amber-500 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
              </button>
            </div>
          )}

          {/* Language Switcher */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>{t.common.language}</span>
              </span>
              <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('el')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    language === 'el'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  EL
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'el' : 'en')}
                title={`Language: ${language.toUpperCase()}. Click to switch.`}
                className="text-[11px] font-black uppercase w-9 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {language.toUpperCase()}
              </button>
            </div>
          )}

          {/* User Profile Card & Logout */}
          {!isCollapsed ? (
            <div className="pt-1">
              <div className="p-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/90 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {currentUser?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-zinc-300 dark:ring-zinc-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      {currentUser?.name?.slice(0, 2).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate leading-tight">
                      {currentUser?.name || 'Guest User'}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate leading-tight">
                      {currentUser?.email || 'Sign in to sync'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  title={t.actions.logout}
                  aria-label={t.actions.logout}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={logout}
                title={`Logged in as ${currentUser?.name || 'User'}. Click to logout.`}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:ring-2 hover:ring-rose-500/50 transition-all cursor-pointer"
              >
                {currentUser?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                    {currentUser?.name?.slice(0, 2).toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* 4. Mobile Bottom Navigation Bar (md:hidden)          */}
      {/* ---------------------------------------------------- */}
      <nav
        role="navigation"
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800/80 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg"
      >
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold min-h-[48px] py-1 px-3 rounded-2xl transition-all relative ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-zinc-950">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] tracking-tight">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
