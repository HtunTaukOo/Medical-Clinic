import { prisma } from "@/lib/prisma";

export const CLINIC_SETTINGS_ID = "clinic-settings";

// The clinic operates in Myanmar. Opening/closing times are wall-clock times in
// this timezone, so "is it open now" must be computed here regardless of the
// server's own timezone (e.g. Vercel runs in UTC, not Asia/Yangon).
export const CLINIC_TIMEZONE = "Asia/Yangon";

export async function getClinicSettings() {
  return prisma.clinicSettings.upsert({
    where: { id: CLINIC_SETTINGS_ID },
    update: {},
    create: { id: CLINIC_SETTINGS_ID },
  });
}

const DEFAULT_WEEKLY_HOURS: Record<number, { isOpen: boolean; openTime: string; closeTime: string }> = {
  0: { isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sun
  1: { isOpen: true, openTime: "08:00", closeTime: "17:00" }, // Mon
  2: { isOpen: true, openTime: "08:00", closeTime: "17:00" }, // Tue
  3: { isOpen: true, openTime: "08:00", closeTime: "17:00" }, // Wed
  4: { isOpen: true, openTime: "08:00", closeTime: "17:00" }, // Thu
  5: { isOpen: true, openTime: "08:00", closeTime: "17:00" }, // Fri
  6: { isOpen: true, openTime: "09:00", closeTime: "14:00" }, // Sat
};

// Seeds any missing weekday rows with sensible defaults, then returns all 7
// ordered Sun-Sat, so the Working Hours UI and booking validation always see
// a complete week even before an admin has customized anything.
export async function getClinicWeeklyHours() {
  const existing = await prisma.clinicWeeklyHours.findMany();
  const existingByDay = new Map(existing.map((h) => [h.weekday, h]));
  const missing = [0, 1, 2, 3, 4, 5, 6].filter((d) => !existingByDay.has(d));
  if (missing.length > 0) {
    await prisma.clinicWeeklyHours.createMany({
      data: missing.map((weekday) => ({ weekday, ...DEFAULT_WEEKLY_HOURS[weekday] })),
      skipDuplicates: true,
    });
    const refreshed = await prisma.clinicWeeklyHours.findMany();
    return refreshed.sort((a, b) => a.weekday - b.weekday);
  }
  return existing.sort((a, b) => a.weekday - b.weekday);
}

// A single fallback open/close pair spanning every day the clinic is open
// (earliest open time to latest close time). Used where a single range is
// needed as a default (e.g. a doctor who hasn't set custom hours), rather
// than per-day hours.
export async function getClinicHoursRange() {
  const week = await getClinicWeeklyHours();
  const openDays = week.filter((h) => h.isOpen);
  if (openDays.length === 0) return { openTime: "09:00", closeTime: "17:00" };
  const openTime = openDays.reduce((min, h) => (h.openTime < min ? h.openTime : min), openDays[0].openTime);
  const closeTime = openDays.reduce((max, h) => (h.closeTime > max ? h.closeTime : max), openDays[0].closeTime);
  return { openTime, closeTime };
}

// The clinic's configured hours for the clinic-local calendar day the given
// instant falls on (falls back to closed if that weekday somehow has no row).
export async function getClinicHoursForDate(date: Date) {
  const weekday = clinicWeekday(date);
  const week = await getClinicWeeklyHours();
  return (
    week.find((h) => h.weekday === weekday) ?? {
      weekday,
      isOpen: false,
      openTime: "09:00",
      closeTime: "17:00",
    }
  );
}

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Myanmar has used a single fixed UTC+6:30 offset with no DST since 1920, so a
// constant offset (rather than a general timezone-database lookup) is safe and
// enough to convert between an absolute instant and clinic-local wall-clock time.
const CLINIC_UTC_OFFSET_MINUTES = 6 * 60 + 30;

export function clinicLocalMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinOpeningHours(
  date: Date,
  openingTime: string,
  closingTime: string
) {
  const minutes = clinicLocalMinutes(date);
  return minutes >= toMinutes(openingTime) && minutes < toMinutes(closingTime);
}

// The clinic-local calendar date (year/month/day) that a given instant falls on.
export function clinicDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

// Use this for appointment grouping and calendar comparisons. Native Date
// getters use the deployment host's timezone, which may not be the clinic's.
export function clinicDateKey(date: Date) {
  const { year, month, day } = clinicDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatClinicDateTime(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: CLINIC_TIMEZONE,
    ...options,
  }).format(date);
}

// The instant corresponding to 00:00 clinic-local time on the given Y-M-D.
export function clinicMidnightForYMD(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - CLINIC_UTC_OFFSET_MINUTES * 60 * 1000);
}

// The instant corresponding to 00:00 clinic-local time on the same clinic-local
// calendar day that the given instant falls on (i.e. "today" in clinic terms).
export function clinicMidnight(date: Date) {
  const { year, month, day } = clinicDateParts(date);
  return clinicMidnightForYMD(year, month, day);
}

// 0 (Sunday) - 6 (Saturday), for the clinic-local calendar day the instant falls on.
export function clinicWeekday(date: Date) {
  const { year, month, day } = clinicDateParts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}
