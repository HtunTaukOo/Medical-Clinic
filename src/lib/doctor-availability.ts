import { prisma } from "@/lib/prisma";
import { toMinutes } from "@/lib/clinic-hours";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toDateOnly(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function parseDateOnlyInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isWorkingDay(workingDays: number[], date: Date) {
  return workingDays.includes(date.getDay());
}

export function isWithinDoctorHours(
  date: Date,
  workStartTime: string | null,
  workEndTime: string | null
) {
  if (!workStartTime || !workEndTime) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= toMinutes(workStartTime) && minutes < toMinutes(workEndTime);
}

export async function isDoctorOnLeave(doctorId: string, date: Date) {
  const leave = await prisma.doctorLeave.findUnique({
    where: { doctorId_date: { doctorId, date: toDateOnly(date) } },
  });
  return !!leave;
}
