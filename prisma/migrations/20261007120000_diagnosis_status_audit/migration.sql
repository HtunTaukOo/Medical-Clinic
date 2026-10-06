ALTER TABLE "Diagnosis"
ADD COLUMN "statusChangedAt" TIMESTAMP(3),
ADD COLUMN "statusChangedAppointmentId" TEXT;
