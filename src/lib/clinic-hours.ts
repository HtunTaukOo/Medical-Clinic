import { prisma } from "@/lib/prisma";

export const CLINIC_SETTINGS_ID = "clinic-settings";

export async function getClinicSettings() {
  return prisma.clinicSettings.upsert({
    where: { id: CLINIC_SETTINGS_ID },
    update: {},
    create: { id: CLINIC_SETTINGS_ID },
  });
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isWithinOpeningHours(
  date: Date,
  openingTime: string,
  closingTime: string
) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= toMinutes(openingTime) && minutes < toMinutes(closingTime);
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}
