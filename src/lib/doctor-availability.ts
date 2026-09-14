import { prisma } from "@/lib/prisma";
import {
  toMinutes,
  clinicLocalMinutes,
  clinicMidnight,
  clinicMidnightForYMD,
  clinicWeekday,
} from "@/lib/clinic-hours";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ShiftRange = { startTime: string; endTime: string };

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

// This doctor's defined shift ranges for the weekday `date` falls on. An
// empty array means no specific shifts have been recorded for that day —
// callers should fall back to the clinic's own default hours for that day
// (kept for backward compatibility with doctors who haven't been given
// specific shifts yet).
export async function getDoctorShiftsForDate(doctorId: string, date: Date): Promise<ShiftRange[]> {
  const weekday = clinicWeekday(date);
  return prisma.doctorShift.findMany({
    where: { doctorId, weekday },
    orderBy: { startTime: "asc" },
    select: { startTime: true, endTime: true },
  });
}

// All of a doctor's shifts across every weekday, grouped by weekday (0=Sun
// .. 6=Sat) — one query for callers that need the whole week at once (e.g.
// the doctor's own schedule view) instead of one query per day.
export async function getDoctorShiftsByWeekday(doctorId: string): Promise<Map<number, ShiftRange[]>> {
  const shifts = await prisma.doctorShift.findMany({
    where: { doctorId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    select: { weekday: true, startTime: true, endTime: true },
  });
  const byWeekday = new Map<number, ShiftRange[]>();
  for (const s of shifts) {
    const list = byWeekday.get(s.weekday) ?? [];
    list.push({ startTime: s.startTime, endTime: s.endTime });
    byWeekday.set(s.weekday, list);
  }
  return byWeekday;
}

export function formatShiftRanges(ranges: ShiftRange[], formatTime: (t: string) => string) {
  return ranges.map((r) => `${formatTime(r.startTime)}–${formatTime(r.endTime)}`).join(", ");
}

// Is this instant within any one of the given shift ranges? An empty
// `ranges` array means "no specific shifts recorded" — treated as
// unrestricted, since the caller is expected to have already applied
// whatever clinic-default-hours fallback applies.
export function isWithinShiftRanges(date: Date, ranges: ShiftRange[]) {
  if (ranges.length === 0) return true;
  const minutes = clinicLocalMinutes(date);
  return ranges.some((r) => minutes >= toMinutes(r.startTime) && minutes < toMinutes(r.endTime));
}

// Is the whole [scheduledAt, scheduledAt + durationMinutes) range fully
// contained within any single one of the given shift ranges? Used for
// BLOCK_CAPACITY bookings, where a 2-3 hour block must fit inside one
// continuous shift (a lunch-break split shift can't itself cover a block
// that spans the break).
export function isRangeWithinShiftRanges(scheduledAt: Date, durationMinutes: number, ranges: ShiftRange[]) {
  if (ranges.length === 0) return true;
  const dayStart = clinicMidnight(scheduledAt);
  const scheduledStartMs = scheduledAt.getTime();
  const scheduledEndMs = scheduledStartMs + durationMinutes * 60 * 1000;
  return ranges.some((r) => {
    const startMs = dayStart.getTime() + toMinutes(r.startTime) * 60 * 1000;
    const endMs = dayStart.getTime() + toMinutes(r.endTime) * 60 * 1000;
    return scheduledStartMs >= startMs && scheduledEndMs <= endMs;
  });
}

// For BLOCK_CAPACITY bookings: is this doctor actually working the full
// [scheduledAt, scheduledAt + durationMinutes) range (a 2-3 hour block),
// independent of leave (checked separately via isDoctorOnLeave)?
export async function isDoctorAvailableForRange(
  doctor: { id: string; workingDays: number[] },
  scheduledAt: Date,
  durationMinutes: number
) {
  if (!isWorkingDay(doctor.workingDays, scheduledAt)) return false;
  const shifts = await getDoctorShiftsForDate(doctor.id, scheduledAt);
  return isRangeWithinShiftRanges(scheduledAt, durationMinutes, shifts);
}

export async function isDoctorOnLeave(doctorId: string, date: Date) {
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: toDateOnly(date) } },
  });
  return !!leave && leave.status === "APPROVED";
}
