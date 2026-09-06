-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "clinicServiceId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceItem_clinicServiceId_idx" ON "InvoiceItem"("clinicServiceId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_clinicServiceId_fkey" FOREIGN KEY ("clinicServiceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
