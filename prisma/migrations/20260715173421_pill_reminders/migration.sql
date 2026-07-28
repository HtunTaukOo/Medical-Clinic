-- AlterTable
ALTER TABLE "PrescriptionItem" ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "timesPerDay" INTEGER;

-- CreateTable
CREATE TABLE "PillReminder" (
    "id" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PillReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PillReminder_sent_scheduledFor_idx" ON "PillReminder"("sent", "scheduledFor");

-- CreateIndex
CREATE INDEX "PillReminder_patientId_idx" ON "PillReminder"("patientId");

-- AddForeignKey
ALTER TABLE "PillReminder" ADD CONSTRAINT "PillReminder_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PillReminder" ADD CONSTRAINT "PillReminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
