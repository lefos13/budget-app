import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { Sidebar } from '@/components/sidebar';
import { AddExpenseModal } from '@/components/modals/add-expense-modal';
import { AddInvoiceModal } from '@/components/modals/add-invoice-modal';
import { InviteModal } from '@/components/modals/invite-modal';
import { NewWalletModal } from '@/components/modals/new-wallet-modal';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// i18n-ignore: static SEO metadata; document.title is localised client-side
export const metadata: Metadata = {
  title: 'Aura Budget — Collaborative Monthly Budget & Invoices',
  description:
    'A modern monthly budget app with expense management, invoice calendar reminders (.ics export), and collaborative wallet sharing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-indigo-500 selection:text-white">
        <div className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.07),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.14),rgba(0,0,0,0))]" />
        <LanguageProvider>
          <AppProvider>
            <div className="flex flex-col md:flex-row min-h-screen bg-zinc-50 dark:bg-zinc-950">
              <Sidebar />
              <div className="flex-1 min-w-0 flex flex-col">
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-12">
                  {children}
                </main>
              </div>
            </div>
            {/* Global Modals */}
            <AddExpenseModal />
            <AddInvoiceModal />
            <InviteModal />
            <NewWalletModal />
          </AppProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
