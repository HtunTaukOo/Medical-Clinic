-- Companion to the previous migration: the "Lab Visit Scheduling"
-- placeholder doctor was also created with workingDays = [1,2,3,4,5,6]
-- (Mon-Sat, no Sunday) — a second artificial ceiling below the clinic's
-- actual hours. isDoctorAvailableForRange checks workingDays before shifts,
-- so on a clinic that's open Sundays, every Lab Visit block on a Sunday
-- failed availability regardless of time. Widen to all 7 days for the same
-- reason as the shift widening — this placeholder should never be the
-- bottleneck; clinic hours + pooled capacity should be.
UPDATE "DoctorProfile"
SET "workingDays" = ARRAY[0,1,2,3,4,5,6]
WHERE id IN (
  SELECT dp.id
  FROM "DoctorProfile" dp
  JOIN "User" u ON u.id = dp."userId"
  WHERE u.email = 'labdoctor@nca.clinic'
);
