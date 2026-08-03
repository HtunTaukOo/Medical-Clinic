-- CreateEnum
CREATE TYPE "WalkInStatus" AS ENUM ('WAITING', 'CALLED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WalkIn" (
    "id" TEXT NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "reason" TEXT,
    "doctorId" TEXT,
    "status" "WalkInStatus" NOT NULL DEFAULT 'WAITING',
    "patientId" TEXT,
    "appointmentId" TEXT,
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalkIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalkIn_appointmentId_key" ON "WalkIn"("appointmentId");

-- CreateIndex
CREATE INDEX "WalkIn_status_createdAt_idx" ON "WalkIn"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WalkIn" ADD CONSTRAINT "WalkIn_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkIn" ADD CONSTRAINT "WalkIn_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalkIn" ADD CONSTRAINT "WalkIn_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
