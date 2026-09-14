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

// For BLOCK_CAPACITY bookings: is this doctor actually working the full
// [scheduledAt, scheduledAt + durationMinutes) range (a 2-3 hour block),
// independent of leave (checked separately via isDoctorOnLeave)?
export function isDoctorAvailableForRange(
  doctor: { workingDays: number[]; workStartTime: string | null; workEndTime: string | null },
  scheduledAt: Date,
  durationMinutes: number
) {
  if (!isWorkingDay(doctor.workingDays, scheduledAt)) return false;
  if (!isWithinDoctorHours(scheduledAt, doctor.workStartTime, doctor.workEndTime)) return false;
  if (doctor.workEndTime) {
    const dayStart = clinicMidnight(scheduledAt);
    const doctorCloseInstant = new Date(dayStart.getTime() + toMinutes(doctor.workEndTime) * 60 * 1000);
    const scheduledEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
    if (scheduledEnd.getTime() > doctorCloseInstant.getTime()) return false;
  }
  return true;
}

export async function isDoctorOnLeave(doctorId: string, date: Date) {
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: toDateOnly(date) } },
  });
  return !!leave && leave.status === "APPROVED";
}
