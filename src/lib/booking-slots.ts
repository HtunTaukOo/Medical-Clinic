import { prisma } from "@/lib/prisma";
import { getClinicSettings, toMinutes, clinicMidnightForYMD, clinicDateParts } from "@/lib/clinic-hours";
import { isDoctorOnLeave, isWorkingDay } from "@/lib/doctor-availability";
import { APPOINTMENT_SLOT_MINUTES } from "@/lib/scheduling";

export type DoctorForSlots = {
  id: string;
  workingDays: number[];
  workStartTime: string | null;
  workEndTime: string | null;
};

export type DaySlot = { time: string; available: boolean };

// True if this clinic-local calendar day is even a candidate for booking at
// all for this doctor (clinic open, doctor working, not on leave) — used to
// gray out whole days in a calendar picker before looking at individual slots.
export async function isDayBookable(
  doctor: DoctorForSlots,
  year: number,
  month: number,
  day: number
): Promise<boolean> {
  const dayStart = clinicMidnightForYMD(year, month, day);
  if (await isDoctorOnLeave(doctor.id, dayStart)) return false;
  if (!isWorkingDay(doctor.workingDays, dayStart)) return false;
  return true;
}

// Enumerates every slot start time (as "HH:mm") for one doctor on one
// clinic-local calendar day within their working hours, each flagged whether
// it's actually bookable (not already past, not taken by an existing
// REQUESTED/CONFIRMED appointment). Returns [] if the day isn't bookable at
// all (leave day, non-working day, clinic closed) — check isDayBookable first
// to tell that apart from "bookable day with a full schedule".
export async function getDaySlots(
  doctor: DoctorForSlots,
  year: number,
  month: number,
  day: number
): Promise<DaySlot[]> {
  if (!(await isDayBookable(doctor, year, month, day))) return [];

  const settings = await getClinicSettings();
  const dayStart = clinicMidnightForYMD(year, month, day);
  const startTime = doctor.workStartTime ?? settings.openingTime;
  const endTime = doctor.workEndTime ?? settings.closingTime;
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const existing = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: { in: ["REQUESTED", "CONFIRMED"] },
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
    select: { scheduledAt: true },
  });
  const takenMs = existing.map((a) => a.scheduledAt.getTime());

  const now = Date.now();
  const slots: DaySlot[] = [];
  for (let m = startMinutes; m < endMinutes; m += APPOINTMENT_SLOT_MINUTES) {
    const slotMs = dayStart.getTime() + m * 60 * 1000;
    const conflicts = takenMs.some((t) => Math.abs(t - slotMs) < APPOINTMENT_SLOT_MINUTES * 60 * 1000);
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push({ time: `${hh}:${mm}`, available: slotMs > now && !conflicts });
  }
  return slots;
}

// Available-only slot start times, for callers that don't need the
// unavailable ones (e.g. counting "N slots available today").
export async function getAvailableSlots(
  doctor: DoctorForSlots,
  year: number,
  month: number,
  day: number
): Promise<string[]> {
  const slots = await getDaySlots(doctor, year, month, day);
  return slots.filter((s) => s.available).map((s) => s.time);
}

export type NextAvailability = { label: string; year: number; month: number; day: number };

// Looks ahead up to 14 clinic-local days to find the next day this doctor has
// at least one open slot, for the "Next: Today / Tomorrow / ..." badge.
export async function getNextAvailability(
  doctor: DoctorForSlots,
  from: Date = new Date()
): Promise<NextAvailability | null> {
  const { year: fromYear, month: fromMonth, day: fromDay } = clinicDateParts(from);
  const fromMidnight = clinicMidnightForYMD(fromYear, fromMonth, fromDay);

  for (let offset = 0; offset < 14; offset++) {
    const candidateMidnight = new Date(fromMidnight.getTime() + offset * 24 * 60 * 60 * 1000);
    const { year: y, month: m, day: d } = clinicDateParts(candidateMidnight);
    const slots = await getAvailableSlots(doctor, y, m, d);
    if (slots.length > 0) {
      const label =
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : candidateMidnight.toLocaleDateString(undefined, {
                timeZone: "Asia/Yangon",
                weekday: "short",
                month: "short",
                day: "numeric",
              });
      return { label, year: y, month: m, day: d };
    }
  }
  return null;
}
