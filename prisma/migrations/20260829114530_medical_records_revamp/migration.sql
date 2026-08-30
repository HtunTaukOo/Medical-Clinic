/*
  Warnings:

  - You are about to drop the column `allergies` on the `Patient` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AllergyCategory" AS ENUM ('DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "DiagnosisStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DiagnosisSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "LabResultStatus" AS ENUM ('NORMAL', 'BORDERLINE', 'LOW', 'HIGH');

-- AlterTable
ALTER TABLE "Diagnosis" ADD COLUMN     "severity" "DiagnosisSeverity",
ADD COLUMN     "status" "DiagnosisStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "LabOrderItem" ADD COLUMN     "resultStatus" "LabResultStatus";

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "allergies";

-- AlterTable
ALTER TABLE "PrescriptionItem" ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "refillsLeft" INTEGER;

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AllergyCategory" NOT NULL DEFAULT 'OTHER',
    "reaction" TEXT,
    "severity" "AllergySeverity" NOT NULL DEFAULT 'MILD',
    "firstNoted" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Allergy_patientId_idx" ON "Allergy"("patientId");

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
