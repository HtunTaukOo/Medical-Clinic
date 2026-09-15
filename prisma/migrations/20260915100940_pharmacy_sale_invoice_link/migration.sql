-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "pharmacySaleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_pharmacySaleId_key" ON "Invoice"("pharmacySaleId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pharmacySaleId_fkey" FOREIGN KEY ("pharmacySaleId") REFERENCES "PharmacySale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
