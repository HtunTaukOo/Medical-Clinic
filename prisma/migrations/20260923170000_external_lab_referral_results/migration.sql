-- Drop the document upload columns (feature reverted)
ALTER TABLE "ExternalLabReferral" DROP COLUMN "documentName";
ALTER TABLE "ExternalLabReferral" DROP COLUMN "documentType";
ALTER TABLE "ExternalLabReferral" DROP COLUMN "documentData";

-- Add result-entry columns to referral items, mirroring LabOrderItem
ALTER TABLE "ExternalLabReferralItem" ADD COLUMN "resultValue" TEXT;
ALTER TABLE "ExternalLabReferralItem" ADD COLUMN "resultNote" TEXT;
ALTER TABLE "ExternalLabReferralItem" ADD COLUMN "resultStatus" "LabResultStatus";
ALTER TABLE "ExternalLabReferralItem" ADD COLUMN "resultEnteredAt" TIMESTAMP(3);
