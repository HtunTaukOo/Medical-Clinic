"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";
import { getAvailableSlots, getDaySlots, isDayBookable, type DaySlot } from "@/lib/booking-slots";
import { clinicMidnightForYMD, toMinutes } from "@/lib/clinic-hours";
import { submitAppointmentRequest, type AppointmentFormState } from "@/actions/appointments";

async function loadDoctorForSlots(doctorId: string) {
  return prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    select: { id: true, workingDays: true, workStartTime: true, workEndTime: true },
  });
}

export async function fetchAvailableSlots(
  doctorId: string,
  year: number,
  month: number,
  day: number
): Promise<string[]> {
  await requireSession();
  const doctor = await loadDoctorForSlots(doctorId);
  if (!doctor) return [];
  return getAvailableSlots(doctor, year, month, day);
}

// Every slot (available or not) for one day, so the UI can show taken/past
// slots as disabled instead of just omitting them.
export async function fetchDaySlots(
  doctorId: string,
  year: number,
  month: number,
  day: number
): Promise<DaySlot[]> {
  await requireSession();
  const doctor = await loadDoctorForSlots(doctorId);
  if (!doctor) return [];
  return getDaySlots(doctor, year, month, day);
}

// Which days in one clinic-local calendar month are worth showing as
// selectable at all (clinic open, doctor working, not on leave) — powers
// graying out whole days in the calendar before the user picks one.
export async function fetchMonthBookability(
  doctorId: string,
  year: number,
  month: number
): Promise<Record<number, boolean>> {
  await requireSession();
  const doctor = await loadDoctorForSlots(doctorId);
  if (!doctor) return {};

  const daysInMonth = new Date(year, month, 0).getDate();
  const result: Record<number, boolean> = {};
  await Promise.all(
    Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
      result[day] = await isDayBookable(doctor, year, month, day);
    })
  );
  return result;
}

export async function confirmBooking(
  doctorId: string,
  year: number,
  month: number,
  day: number,
  time: string,
  reason: string,
  durationMinutes: number = 30
): Promise<AppointmentFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const scheduledAt = new Date(
    clinicMidnightForYMD(year, month, day).getTime() + toMinutes(time) * 60 * 1000
  );

  return submitAppointmentRequest(patientId, doctorId, scheduledAt, reason || undefined, durationMinutes);
}
