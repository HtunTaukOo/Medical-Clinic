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
