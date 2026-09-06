-- AlterTable
ALTER TABLE "ClinicSettings" DROP COLUMN "closingTime",
DROP COLUMN "isOpen",
DROP COLUMN "openingTime",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoType" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'NCA Clinic';

-- CreateTable
CREATE TABLE "ClinicWeeklyHours" (
    "weekday" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL DEFAULT '09:00',
    "closeTime" TEXT NOT NULL DEFAULT '17:00',

    CONSTRAINT "ClinicWeeklyHours_pkey" PRIMARY KEY ("weekday")
);

