import { prisma } from "@/lib/prisma";
import {
  toMinutes,
  clinicLocalMinutes,
  clinicMidnight,
  clinicMidnightForYMD,
  clinicWeekday,
} from "@/lib/clinic-hours";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Normalizes an instant (e.g. an appointment's scheduledAt) down to clinic-local
// midnight of the calendar day it falls on, for matching against leave days.
export function toDateOnly(date: Date) {
  return clinicMidnight(date);
}

// Parses a "YYYY-MM-DD" value from a date input as a clinic-local calendar day,
// so it lines up with toDateOnly() when matched against a stored leave day.
export function parseDateOnlyInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return clinicMidnightForYMD(year, month, day);
}

export function isWorkingDay(workingDays: number[], date: Date) {
  return workingDays.includes(clinicWeekday(date));
}

export function isWithinDoctorHours(
  date: Date,
  workStartTime: string | null,
  workEndTime: string | null
) {
  if (!workStartTime || !workEndTime) return true;
  const minutes = clinicLocalMinutes(date);
  return minutes >= toMinutes(workStartTime) && minutes < toMinutes(workEndTime);
}

export async function isDoctorOnLeave(doctorId: string, date: Date) {
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: toDateOnly(date) } },
  });
  return !!leave;
}
