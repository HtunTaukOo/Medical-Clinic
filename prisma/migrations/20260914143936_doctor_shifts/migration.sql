-- CreateTable
CREATE TABLE "DoctorShift" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorShift_doctorId_weekday_idx" ON "DoctorShift"("doctorId", "weekday");

ALTER TABLE "DoctorShift" ADD CONSTRAINT "DoctorShift_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one shift row per working day, for doctors who had explicit
-- hours set (workingDays alone, with no explicit hours, already falls back
-- to the clinic's default hours going forward — no row needed for those).
INSERT INTO "DoctorShift" ("id", "doctorId", "weekday", "startTime", "endTime", "createdAt")
SELECT gen_random_uuid()::text, dp."id", wd, dp."workStartTime", dp."workEndTime", now()
FROM "DoctorProfile" dp, unnest(dp."workingDays") AS wd
WHERE dp."workStartTime" IS NOT NULL AND dp."workEndTime" IS NOT NULL;

-- AlterTable: the flat pair is now fully replaced by per-day DoctorShift rows.
ALTER TABLE "DoctorProfile" DROP COLUMN "workEndTime",
DROP COLUMN "workStartTime";
