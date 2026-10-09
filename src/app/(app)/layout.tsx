import type { Metadata } from 'next';
import { RootDocument } from '@/components/root-document';
import { AppProvider } from '@/context/AppContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { AppShell } from '@/components/app-shell';
import { AddExpenseModal } from '@/components/modals/add-expense-modal';
import { AddInvoiceModal } from '@/components/modals/add-invoice-modal';
import { InviteModal } from '@/components/modals/invite-modal';
import { NewWalletModal } from '@/components/modals/new-wallet-modal';

// i18n-ignore: static fallback metadata; document.title is localised client-side
export const metadata: Metadata = {
  title: 'Aura Budget',
  applicationName: 'Aura Budget',
  /* The signed-in app, auth pages and invites are never search results; the landing is `(marketing)`. */
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RootDocument lang="el">
      <LanguageProvider>
        <AppProvider>
          <AppShell>{children}</AppShell>
          {/* Global Modals */}
          <AddExpenseModal />
          <AddInvoiceModal />
          <InviteModal />
          <NewWalletModal />
        </AppProvider>
      </LanguageProvider>
    </RootDocument>
  );
}
