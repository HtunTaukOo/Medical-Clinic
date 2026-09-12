-- CreateEnum
CREATE TYPE "DoctorLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "StaffNotificationCategory" ADD VALUE 'LEAVE';

-- AlterTable
ALTER TABLE "DoctorLeave" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decidedByName" TEXT,
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "status" "DoctorLeaveStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "DoctorLeave_doctorId_status_idx" ON "DoctorLeave"("doctorId", "status");
