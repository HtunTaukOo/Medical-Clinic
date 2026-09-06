-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLowStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyNewAppointments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;
