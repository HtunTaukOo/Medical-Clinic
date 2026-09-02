-- AlterTable
ALTER TABLE "Prescription" ALTER COLUMN "appointmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PrescriptionItem" ADD COLUMN     "duration" TEXT,
ALTER COLUMN "quantity" DROP NOT NULL;
