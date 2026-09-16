-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "staffCompletedAt" TIMESTAMP(3),
ADD COLUMN     "staffCompletedById" TEXT,
ADD COLUMN     "staffCompletedByName" TEXT;

-- Backfill: grandfather in every appointment that was already COMPLETED
-- before this two-stage checkout step existed. Without this, every patient
-- with ANY historical completed visit would suddenly be blocked from
-- booking again the moment this ships, since staffCompletedAt didn't exist
-- yet when those visits were actually completed. Only appointments
-- completed AFTER this migration require the new, real staff checkout step.
UPDATE "Appointment" SET "staffCompletedAt" = "updatedAt" WHERE "status" = 'COMPLETED' AND "staffCompletedAt" IS NULL;
