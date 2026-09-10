-- AlterEnum
ALTER TYPE "StaffNotificationCategory" ADD VALUE 'BILLING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyBilling" BOOLEAN NOT NULL DEFAULT true;
