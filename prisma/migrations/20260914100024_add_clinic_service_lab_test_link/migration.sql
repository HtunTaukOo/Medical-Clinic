-- AlterTable
ALTER TABLE "ClinicService" ADD COLUMN     "labTestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClinicService_labTestId_key" ON "ClinicService"("labTestId");

-- AddForeignKey
ALTER TABLE "ClinicService" ADD CONSTRAINT "ClinicService_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

