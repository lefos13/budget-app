-- trackFromMonth was added to schema.prisma in 38c24d9 without a migration (applied locally via db push).
-- AlterTable
ALTER TABLE "PlannedExpense" ADD COLUMN "trackFromMonth" TEXT;
