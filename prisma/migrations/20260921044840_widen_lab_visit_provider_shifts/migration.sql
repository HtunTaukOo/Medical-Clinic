-- The "Lab Visit Scheduling" account is a placeholder doctor of record for
-- SERVICE_CAPACITY specialties (e.g. "Lab Visit") — nobody actually logs
-- into it, and patients never see it; it exists purely so Appointment.
-- doctorId has something to point at. It was created (see
-- createLabVisitProvider in src/actions/lab-import-temp.ts) with an
-- arbitrary 08:00-17:00 shift every day, which meant it silently became a
-- second, tighter availability ceiling on top of the clinic's own
-- configured hours: getBlockDaySlots requires at least one eligible doctor
-- whose shift fully covers a block, so on a clinic that's open past 5pm
-- (e.g. 8am-8pm), every block starting at/after 4pm failed that check even
-- though the clinic itself was open — nothing to do with real doctor
-- availability, since there isn't a real doctor here to be unavailable.
-- Widen it to the full day so clinic hours + pooled capacity remain the
-- only real constraints on these bookings, matching the intended design.
UPDATE "DoctorShift"
SET "startTime" = '00:00', "endTime" = '23:59'
WHERE "doctorId" IN (
  SELECT dp.id
  FROM "DoctorProfile" dp
  JOIN "User" u ON u.id = dp."userId"
  WHERE u.email = 'labdoctor@nca.clinic'
);
