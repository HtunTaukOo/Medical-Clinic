import { prisma } from "@/lib/prisma";
import { clinicMidnight } from "@/lib/clinic-hours";

export const SELF_CHECK_IN_BEFORE_MINUTES = 30;
export const SELF_CHECK_IN_AFTER_MINUTES = 60;

// "After" widens to cover the whole appointment (block appointments run
// 2-3 hours, not the old fixed 30-min slot), so a patient can self-check-in
// anywhere up to the appointment's own end time, not just a flat 60 minutes
// after its start.
export function isWithinSelfCheckInWindow(
  scheduledAt: Date,
  durationMinutes: number,
  now: Date = new Date()
) {
  const diffMs = now.getTime() - scheduledAt.getTime();
  const beforeMs = SELF_CHECK_IN_BEFORE_MINUTES * 60 * 1000;
  const afterMs = Math.max(SELF_CHECK_IN_AFTER_MINUTES * 60 * 1000, durationMinutes * 60 * 1000);
  return diffMs >= -beforeMs && diffMs <= afterMs;
}

export function todayRange() {
  const start = clinicMidnight(new Date());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getQueuePosition(doctorId: string, checkedInAt: Date) {
  const aheadCount = await prisma.appointment.count({
    where: {
      doctorId,
      status: "CHECKED_IN",
      checkedInAt: { lt: checkedInAt },
    },
  });
  return aheadCount + 1;
}
