-- CreateTable
CREATE TABLE "SavingsBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GOAL',
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "icon" TEXT NOT NULL DEFAULT 'PiggyBank',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavingsBucket_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingsTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "transferGroupId" TEXT,
    "plannedExpenseId" TEXT,
    "expenseId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingsTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingsTransaction_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "SavingsBucket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavingsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavingsTransaction_plannedExpenseId_fkey" FOREIGN KEY ("plannedExpenseId") REFERENCES "PlannedExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SavingsTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable (additive; hand-written instead of Prisma's copy-and-drop table rebuild so existing rows are never rewritten)
ALTER TABLE "Expense" ADD COLUMN "savingsFundedAmount" REAL NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PlannedExpense" ADD COLUMN "savingsBucketId" TEXT REFERENCES "SavingsBucket" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PlannedExpense_savingsBucketId_idx" ON "PlannedExpense"("savingsBucketId");

-- CreateIndex
CREATE INDEX "SavingsBucket_walletId_status_idx" ON "SavingsBucket"("walletId", "status");

-- CreateIndex
CREATE INDEX "SavingsTransaction_walletId_date_idx" ON "SavingsTransaction"("walletId", "date");

-- CreateIndex
CREATE INDEX "SavingsTransaction_bucketId_idx" ON "SavingsTransaction"("bucketId");
