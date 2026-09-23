-- CreateEnum
CREATE TYPE "ExternalLabReferralStatus" AS ENUM ('SENDING', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LabTest" ADD COLUMN     "requiresExternalLab" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExternalLabReferral" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "referredLabName" TEXT NOT NULL,
    "status" "ExternalLabReferralStatus" NOT NULL DEFAULT 'SENDING',
    "sampleCollectedAt" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "receivedById" TEXT,
    "receivedByName" TEXT,
    "receivedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalLabReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalLabReferralItem" (
    "id" TEXT NOT NULL,
    "externalLabReferralId" TEXT NOT NULL,
    "labTestId" TEXT NOT NULL,

    CONSTRAINT "ExternalLabReferralItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalLabReferral_patientId_idx" ON "ExternalLabReferral"("patientId");

-- CreateIndex
CREATE INDEX "ExternalLabReferral_status_idx" ON "ExternalLabReferral"("status");

-- CreateIndex
CREATE INDEX "ExternalLabReferralItem_externalLabReferralId_idx" ON "ExternalLabReferralItem"("externalLabReferralId");

-- AddForeignKey
ALTER TABLE "ExternalLabReferral" ADD CONSTRAINT "ExternalLabReferral_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLabReferralItem" ADD CONSTRAINT "ExternalLabReferralItem_externalLabReferralId_fkey" FOREIGN KEY ("externalLabReferralId") REFERENCES "ExternalLabReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLabReferralItem" ADD CONSTRAINT "ExternalLabReferralItem_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
