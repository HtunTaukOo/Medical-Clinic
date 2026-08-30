-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "chiefComplaint" TEXT,
ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "physicalExam" TEXT,
ADD COLUMN     "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "treatmentPlan" TEXT,
ADD COLUMN     "weightKg" DOUBLE PRECISION;
