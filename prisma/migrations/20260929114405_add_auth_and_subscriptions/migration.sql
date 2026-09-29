-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceBill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BILL',
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceInterval" TEXT NOT NULL DEFAULT 'NONE',
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "paidAt" DATETIME,
    "paidByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceBill_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceBill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InvoiceBill_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceBill" ("amount", "categoryId", "createdAt", "dueDate", "id", "invoiceNumber", "isRecurring", "notes", "paidAt", "paidByUserId", "recurrenceInterval", "reminderDaysBefore", "status", "title", "updatedAt", "userId", "walletId") SELECT "amount", "categoryId", "createdAt", "dueDate", "id", "invoiceNumber", "isRecurring", "notes", "paidAt", "paidByUserId", "recurrenceInterval", "reminderDaysBefore", "status", "title", "updatedAt", "userId", "walletId" FROM "InvoiceBill";
DROP TABLE "InvoiceBill";
ALTER TABLE "new_InvoiceBill" RENAME TO "InvoiceBill";
CREATE TABLE "new_WalletInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "targetEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletInvite_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WalletInvite" ("code", "createdAt", "expiresAt", "id", "maxUses", "role", "usedCount", "walletId") SELECT "code", "createdAt", "expiresAt", "id", "maxUses", "role", "usedCount", "walletId" FROM "WalletInvite";
DROP TABLE "WalletInvite";
ALTER TABLE "new_WalletInvite" RENAME TO "WalletInvite";
CREATE UNIQUE INDEX "WalletInvite_code_key" ON "WalletInvite"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
