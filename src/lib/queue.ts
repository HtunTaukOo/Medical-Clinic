import { prisma } from "@/lib/prisma";
import { clinicMidnight } from "@/lib/clinic-hours";

export const SELF_CHECK_IN_BEFORE_MINUTES = 30;
export const SELF_CHECK_IN_AFTER_MINUTES = 60;

export function isWithinSelfCheckInWindow(scheduledAt: Date, now: Date = new Date()) {
  const diffMs = now.getTime() - scheduledAt.getTime();
  const beforeMs = SELF_CHECK_IN_BEFORE_MINUTES * 60 * 1000;
  const afterMs = SELF_CHECK_IN_AFTER_MINUTES * 60 * 1000;
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
