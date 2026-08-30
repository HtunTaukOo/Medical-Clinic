-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowAnalytics" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bloodType" TEXT,
ADD COLUMN     "emergencyContactAddress" TEXT,
ADD COLUMN     "emergencyContactAltPhone" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "insuranceCoverageType" TEXT,
ADD COLUMN     "insuranceExpiryDate" TIMESTAMP(3),
ADD COLUMN     "insuranceGroupNumber" TEXT,
ADD COLUMN     "insurancePolicyHolder" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyAppointmentReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLabResults" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPrescriptionRenewals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPromotions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nrcNumber" TEXT,
ADD COLUMN     "patientCode" TEXT,
ADD COLUMN     "shareRecordsWithSpecialist" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weightKg" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientCode_key" ON "Patient"("patientCode");

