-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'CHECKED_IN';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "checkedInAt" TIMESTAMP(3);
