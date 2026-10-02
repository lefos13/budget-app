-- Add a stable series id to InvoiceBill so every occurrence of one recurring bill/subscription can be
-- grouped regardless of later title edits. Existing data is preserved; recurring rows are backfilled
-- per (walletId, type, title) with the id of the series' earliest row, one-off rows get their own id.

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
    "seriesId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceBill_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceBill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InvoiceBill_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceBill" ("amount", "categoryId", "createdAt", "dueDate", "id", "invoiceNumber", "isRecurring", "notes", "paidAt", "paidByUserId", "recurrenceInterval", "reminderDaysBefore", "status", "title", "type", "updatedAt", "userId", "walletId", "seriesId")
SELECT b."amount", b."categoryId", b."createdAt", b."dueDate", b."id", b."invoiceNumber", b."isRecurring", b."notes", b."paidAt", b."paidByUserId", b."recurrenceInterval", b."reminderDaysBefore", b."status", b."title", b."type", b."updatedAt", b."userId", b."walletId",
    CASE
        WHEN b."type" = 'SUBSCRIPTION' OR (b."isRecurring" = 1 AND b."recurrenceInterval" <> 'NONE') THEN (
            SELECT o."id" FROM "InvoiceBill" o
            WHERE o."walletId" = b."walletId"
              AND o."type" = b."type"
              AND o."title" = b."title"
              AND (o."type" = 'SUBSCRIPTION' OR (o."isRecurring" = 1 AND o."recurrenceInterval" <> 'NONE'))
            ORDER BY o."dueDate", o."createdAt", o."id"
            LIMIT 1
        )
        ELSE b."id"
    END
FROM "InvoiceBill" b;
DROP TABLE "InvoiceBill";
ALTER TABLE "new_InvoiceBill" RENAME TO "InvoiceBill";
CREATE INDEX "InvoiceBill_walletId_seriesId_idx" ON "InvoiceBill"("walletId", "seriesId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
