-- AlterTable
ALTER TABLE "WalletMember" ADD COLUMN "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WalletMember_calendarToken_key" ON "WalletMember"("calendarToken");
