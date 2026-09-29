'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface WalletInvite {
  id: string;
  code: string;
  role?: string;
  expiresAt?: string | null;
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  userId?: string | null;
  user?: User | null;
}

export interface WalletSummary {
  id: string;
  name: string;
  currency: string;
  monthlyBudget: number;
  color: string;
  icon: string;
  userRole: string;
  members: { id: string; role: string; user: User }[];
  categories: { id: string; name: string; color: string; icon: string; monthlyLimit: number | null }[];
  invites?: WalletInvite[];
  activityLogs?: ActivityLogItem[];
  _count?: { expenses: number; invoices: number };
}

export interface CategoryWithSpent {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyLimit: number | null;
  spent: number;
  percentage: number;
}

export interface ExpenseItem {
  id: string;
  walletId: string;
  userId: string;
  categoryId: string | null;
  title: string;
  amount: number;
  date: string;
  notes: string | null;
  isRecurring: boolean;
  category: { id: string; name: string; color: string; icon: string } | null;
  user: User;
}

export interface InvoiceItem {
  id: string;
  walletId: string;
  userId: string;
  categoryId: string | null;
  title: string;
  amount: number;
  type?: 'BILL' | 'SUBSCRIPTION' | string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  isRecurring: boolean;
  recurrenceInterval: string;
  reminderDaysBefore: number;
  invoiceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  paidByUser?: User | null;
  category: { id: string; name: string; color: string; icon: string } | null;
}

export interface WalletDetailData {
  wallet: WalletSummary;
  userRole: string;
  currentUser: User;
  metrics: {
    monthlyBudget: number;
    totalSpentMonth: number;
    remainingBudget: number;
    pendingCount: number;
    overdueCount: number;
    paidCount: number;
  };
  categories: CategoryWithSpent[];
  recentExpenses: ExpenseItem[];
  invoices: InvoiceItem[];
}

export type AuthMode = 'mock' | 'normal';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  setCurrentUser: (user: User) => void;
  wallets: WalletSummary[];
  activeWalletId: string | null;
  setActiveWalletId: (id: string) => void;
  walletData: WalletDetailData | null;
  isLoading: boolean;
  refreshWallet: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  // Auth & Dual Mode
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  logout: () => Promise<void>;
  // Modals
  isAddExpenseOpen: boolean;
  setIsAddExpenseOpen: (open: boolean) => void;
  isAddInvoiceOpen: boolean;
  setIsAddInvoiceOpen: (open: boolean) => void;
  modalInitialDate: string | null;
  openAddExpense: (dateStr?: string) => void;
  openAddInvoice: (dateStr?: string) => void;
  isInviteOpen: boolean;
  setIsInviteOpen: (open: boolean) => void;
  isNewWalletOpen: boolean;
  setIsNewWalletOpen: (open: boolean) => void;
  // Trigger toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function subscribeAuthMode(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getAuthModeSnapshot(): AuthMode {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_AUTH_MODE === 'normal' ? 'normal' : 'mock';
  }
  const savedMode = localStorage.getItem('aura_auth_mode') as AuthMode | null;
  if (savedMode === 'mock' || savedMode === 'normal') return savedMode;
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'normal' ? 'normal' : 'mock';
}

function getAuthModeServerSnapshot(): AuthMode {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'normal' ? 'normal' : 'mock';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const storeAuthMode = React.useSyncExternalStore(
    subscribeAuthMode,
    getAuthModeSnapshot,
    getAuthModeServerSnapshot
  );

  const [activeAuthMode, setActiveAuthMode] = useState<AuthMode | null>(null);
  const authMode = activeAuthMode ?? storeAuthMode;

  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [activeWalletId, setActiveWalletIdState] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddExpenseOpen, setIsAddExpenseOpenState] = useState(false);
  const [isAddInvoiceOpen, setIsAddInvoiceOpenState] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isNewWalletOpen, setIsNewWalletOpen] = useState(false);

  const setIsAddExpenseOpen = useCallback((open: boolean) => {
    setIsAddExpenseOpenState(open);
    if (!open) setModalInitialDate(null);
  }, []);

  const setIsAddInvoiceOpen = useCallback((open: boolean) => {
    setIsAddInvoiceOpenState(open);
    if (!open) setModalInitialDate(null);
  }, []);

  const openAddExpense = useCallback((dateStr?: string) => {
    if (dateStr) setModalInitialDate(dateStr);
    setIsAddExpenseOpenState(true);
  }, []);

  const openAddInvoice = useCallback((dateStr?: string) => {
    if (dateStr) setModalInitialDate(dateStr);
    setIsAddInvoiceOpenState(true);
  }, []);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (currentUser?.id) {
      headers['x-user-id'] = currentUser.id;
    }
    return headers;
  }, [currentUser]);

  // Load user asynchronously when authMode changes
  useEffect(() => {
    let isMounted = true;
    async function initUser() {
      try {
        if (authMode === 'normal') {
          const res = await fetch('/api/auth/me', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (isMounted) setCurrentUserState(data.user || null);
          } else {
            if (isMounted) setCurrentUserState(null);
          }
        } else {
          const res = await fetch('/api/users');
          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              setUsers(data.users || []);
              const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('aura_active_user_id') : null;
              const found = data.users.find((u: User) => u.id === savedUserId);
              setCurrentUserState(found || data.users[0] || null);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void initUser();
    return () => {
      isMounted = false;
    };
  }, [authMode]);

  // Route protection in Normal mode
  useEffect(() => {
    if (isLoading) return;
    const isAuthPage = pathname === '/login' || pathname === '/register';
    const isPublicPage = isAuthPage || pathname?.startsWith('/invite');

    if (authMode === 'normal') {
      if (!currentUser && !isPublicPage) {
        router.push('/login');
      } else if (currentUser && isAuthPage) {
        router.push('/');
      }
    }
  }, [authMode, currentUser, isLoading, pathname, router]);

  const setAuthMode = (mode: AuthMode) => {
    setActiveAuthMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura_auth_mode', mode);
      window.dispatchEvent(new Event('storage'));
    }
    showToast(
      mode === 'normal'
        ? 'Switched to Normal Flow (Real Auth)'
        : 'Switched to Dev Mock Mode (Simulate Users)'
    );
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setCurrentUserState(null);
      setWalletData(null);
      setWallets([]);
      setActiveWalletIdState(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aura_active_user_id');
        localStorage.removeItem('aura_active_wallet_id');
      }
      showToast('Logged out successfully');
      router.push('/login');
    }
  };

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura_active_user_id', user.id);
    }
  };

  const setActiveWalletId = (id: string) => {
    setActiveWalletIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura_active_wallet_id', id);
    }
  };

  // Fetch wallets when currentUser changes
  const refreshWallets = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/wallets', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setWallets(data.wallets || []);

        const savedWalletId = typeof window !== 'undefined' ? localStorage.getItem('aura_active_wallet_id') : null;
        const exists = data.wallets.some((w: WalletSummary) => w.id === savedWalletId);

        if (savedWalletId && exists) {
          setActiveWalletIdState(savedWalletId);
        } else if (data.wallets.length > 0) {
          setActiveWalletIdState(data.wallets[0].id);
        } else {
          setActiveWalletIdState(null);
        }
      }
    } catch (err) {
      console.error('Failed to load wallets:', err);
    }
  }, [currentUser, getHeaders]);

  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    const loadWallets = async () => {
      if (isMounted) {
        await refreshWallets();
      }
    };
    void loadWallets();
    return () => {
      isMounted = false;
    };
  }, [currentUser, refreshWallets]);

  // Fetch active wallet data
  const refreshWallet = useCallback(async () => {
    if (!activeWalletId) {
      setWalletData(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`/api/wallets/${activeWalletId}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setWalletData(data);
      }
    } catch (err) {
      console.error('Failed to fetch wallet details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWalletId, getHeaders]);

  useEffect(() => {
    let isMounted = true;
    const loadActiveWallet = async () => {
      if (activeWalletId) {
        if (isMounted) {
          await refreshWallet();
        }
      } else {
        if (isMounted) {
          setWalletData(null);
          setIsLoading(false);
        }
      }
    };
    void loadActiveWallet();
    return () => {
      isMounted = false;
    };
  }, [activeWalletId, refreshWallet]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        setCurrentUser,
        wallets,
        activeWalletId,
        setActiveWalletId,
        walletData,
        isLoading,
        refreshWallet,
        refreshWallets,
        authMode,
        setAuthMode,
        logout,
        isAddExpenseOpen,
        setIsAddExpenseOpen,
        isAddInvoiceOpen,
        setIsAddInvoiceOpen,
        modalInitialDate,
        openAddExpense,
        openAddInvoice,
        isInviteOpen,
        setIsInviteOpen,
        isNewWalletOpen,
        setIsNewWalletOpen,
        toastMessage,
        showToast,
      }}
    >
      {children}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md border border-zinc-700/80 text-white px-4 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-5 max-w-[calc(100vw-2rem)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <p className="text-xs sm:text-sm font-semibold truncate">{toastMessage}</p>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
