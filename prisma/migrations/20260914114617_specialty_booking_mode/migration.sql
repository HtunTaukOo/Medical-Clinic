-- CreateEnum
CREATE TYPE "SpecialtyBookingMode" AS ENUM ('DOCTOR_CALENDAR', 'SERVICE_CAPACITY', 'BLOCK_CAPACITY');

-- AlterTable: add bookingMode, backfill from bookByService, then drop bookByService
ALTER TABLE "Specialty" ADD COLUMN "bookingMode" "SpecialtyBookingMode" NOT NULL DEFAULT 'DOCTOR_CALENDAR';

UPDATE "Specialty" SET "bookingMode" = 'SERVICE_CAPACITY' WHERE "bookByService" = true;
UPDATE "Specialty" SET "bookingMode" = 'BLOCK_CAPACITY', "capacityPerSlot" = 10 WHERE "bookByService" = false;

ALTER TABLE "Specialty" DROP COLUMN "bookByService";

-- Waitlist redesign: specialty+day+block instead of doctor+exact time.
-- Existing WAITING rows have no specialty/block to backfill from and are
-- inherently short-lived — clear the table rather than guess.
DELETE FROM "Waitlist";

-- DropForeignKey
ALTER TABLE "Waitlist" DROP CONSTRAINT "Waitlist_doctorId_fkey";

-- DropIndex
DROP INDEX "Waitlist_doctorId_status_requestedAt_idx";

-- AlterTable
ALTER TABLE "Waitlist" DROP COLUMN "doctorId",
DROP COLUMN "requestedAt",
ADD COLUMN     "blockId" TEXT NOT NULL,
ADD COLUMN     "requestedDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "specialtyName" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Waitlist_specialtyName_requestedDate_blockId_status_idx" ON "Waitlist"("specialtyName", "requestedDate", "blockId", "status");
