-- AlterTable
ALTER TABLE "ExternalLabReferral" ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "documentData" BYTEA;
