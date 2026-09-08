-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "clinicServiceId" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_clinicServiceId_idx" ON "Appointment"("clinicServiceId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicServiceId_fkey" FOREIGN KEY ("clinicServiceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
