"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";
import {
  getAvailableSlots,
  getDaySlots,
  isDayBookable,
  getResourceDaySlots,
  isResourceDayBookable,
  getBlockDaySlots,
  type DaySlot,
  type BlockAvailability,
} from "@/lib/booking-slots";
import { clinicMidnightForYMD, toMinutes } from "@/lib/clinic-hours";
import { submitAppointmentRequest, type AppointmentFormState } from "@/actions/appointments";
import { getTimeBlockById, blockDurationMinutes, TIME_BLOCKS } from "@/lib/time-blocks";
import { isDoctorOnLeave, isDoctorAvailableForRange } from "@/lib/doctor-availability";

async function loadDoctorForSlots(doctorId: string) {
  return prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    select: { id: true, workingDays: true },
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
  durationMinutes: number = 30,
  clinicServiceId?: string | null
): Promise<AppointmentFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const scheduledAt = new Date(
    clinicMidnightForYMD(year, month, day).getTime() + toMinutes(time) * 60 * 1000
  );

  return submitAppointmentRequest(
    patientId,
    doctorId,
    scheduledAt,
    reason || undefined,
    durationMinutes,
    clinicServiceId
  );
}

// The "book by service" counterpart to fetchDaySlots/fetchMonthBookability/
// confirmBooking above — availability comes from clinic hours + a shared
// capacity for the specialty (e.g. a lab with 3 stations) instead of any one
// doctor's calendar.
export async function fetchResourceDaySlots(
  specialtyName: string,
  capacityPerSlot: number,
  year: number,
  month: number,
  day: number
): Promise<DaySlot[]> {
  await requireSession();
  return getResourceDaySlots({ specialtyName, capacityPerSlot }, year, month, day);
}

export async function fetchResourceMonthBookability(
  year: number,
  month: number
): Promise<Record<number, boolean>> {
  await requireSession();
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: Record<number, boolean> = {};
  await Promise.all(
    Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
      result[day] = await isResourceDayBookable(year, month, day);
    })
  );
  return result;
}

export async function confirmResourceBooking(
  specialtyName: string,
  year: number,
  month: number,
  day: number,
  time: string,
  reason: string,
  durationMinutes: number = 30,
  clinicServiceId?: string | null
): Promise<AppointmentFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const specialty = await prisma.specialty.findUnique({ where: { name: specialtyName } });
  if (!specialty || specialty.bookingMode !== "SERVICE_CAPACITY") {
    return { error: "This specialty isn't set up for service-based booking." };
  }

  // Deterministic (by id) so this always agrees with the client's own
  // display-only pick in the booking wizard (pickAutoDoctor), even when
  // multiple doctors share this specialty.
  const doctor = await prisma.doctorProfile.findFirst({
    where: { specialty: specialtyName },
    orderBy: { id: "asc" },
  });
  if (!doctor) {
    return { error: "No staff are set up for this specialty yet. Please contact the clinic." };
  }

  const scheduledAt = new Date(
    clinicMidnightForYMD(year, month, day).getTime() + toMinutes(time) * 60 * 1000
  );

  return submitAppointmentRequest(
    patientId,
    doctor.id,
    scheduledAt,
    reason || undefined,
    durationMinutes,
    clinicServiceId,
    { specialtyName, capacityPerSlot: specialty.capacityPerSlot }
  );
}

// BLOCK_CAPACITY counterpart: fixed daily blocks with pooled capacity across
// every doctor with this specialty, no single doctor's hours involved yet
// (the doctor is chosen after the block — see confirmBlockBooking below).
export async function fetchBlockAvailability(
  specialtyName: string,
  capacityPerSlot: number,
  year: number,
  month: number,
  day: number
): Promise<BlockAvailability[]> {
  await requireSession();
  return getBlockDaySlots(specialtyName, capacityPerSlot, year, month, day);
}

export async function fetchBlockMonthBookability(
  year: number,
  month: number
): Promise<Record<number, boolean>> {
  await requireSession();
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: Record<number, boolean> = {};
  await Promise.all(
    Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
      result[day] = await isResourceDayBookable(year, month, day);
    })
  );
  return result;
}

// Which doctors of this specialty are actually eligible to be picked for the
// chosen block — filters out anyone on leave that day, not working that
// weekday, or whose own hours don't cover the whole block. Capacity itself
// stays pooled (checked separately), this is purely "can this doctor take
// patients then at all."
export async function fetchEligibleDoctorIds(
  specialtyName: string,
  year: number,
  month: number,
  day: number,
  blockId: string
): Promise<string[]> {
  await requireSession();
  const block = getTimeBlockById(blockId);
  if (!block) return [];

  const scheduledAt = new Date(
    clinicMidnightForYMD(year, month, day).getTime() + toMinutes(block.startTime) * 60 * 1000
  );
  const durationMinutes = blockDurationMinutes(block);

  const doctors = await prisma.doctorProfile.findMany({
    where: { specialty: specialtyName },
    select: { id: true, workingDays: true },
  });

  const eligible = await Promise.all(
    doctors.map(async (doctor) => {
      if (!(await isDoctorAvailableForRange(doctor, scheduledAt, durationMinutes))) return null;
      if (await isDoctorOnLeave(doctor.id, scheduledAt)) return null;
      return doctor.id;
    })
  );
  return eligible.filter((id): id is string => id != null);
}

// For a specific, already-chosen doctor (staff/doctor manual booking, where
// the doctor is picked before the block, unlike the patient wizard): which
// of the 5 fixed blocks can this doctor actually cover that day? Lets the
// block picker gray out/flag blocks this doctor doesn't work, instead of
// letting staff pick one that would silently fail at submit time.
export async function fetchDoctorBlockEligibility(
  doctorId: string,
  year: number,
  month: number,
  day: number
): Promise<Record<string, boolean>> {
  await requireSession();
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    select: { id: true, workingDays: true },
  });
  if (!doctor) return {};

  const dayStart = clinicMidnightForYMD(year, month, day);
  const onLeave = await isDoctorOnLeave(doctor.id, dayStart);

  const result: Record<string, boolean> = {};
  for (const block of TIME_BLOCKS) {
    const scheduledAt = new Date(dayStart.getTime() + toMinutes(block.startTime) * 60 * 1000);
    result[block.id] =
      !onLeave && (await isDoctorAvailableForRange(doctor, scheduledAt, blockDurationMinutes(block)));
  }
  return result;
}

// Unlike confirmResourceBooking (which auto-assigns the sole doctor for a
// SERVICE_CAPACITY specialty), this takes the patient's own doctor choice —
// BLOCK_CAPACITY specialties pool capacity across doctors, but each
// appointment still has one real, patient-picked doctor of record.
export async function confirmBlockBooking(
  specialtyName: string,
  doctorId: string,
  year: number,
  month: number,
  day: number,
  blockId: string,
  reason: string,
  clinicServiceId?: string | null
): Promise<AppointmentFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const specialty = await prisma.specialty.findUnique({ where: { name: specialtyName } });
  if (!specialty || specialty.bookingMode !== "BLOCK_CAPACITY") {
    return { error: "This specialty isn't set up for block booking." };
  }

  const block = getTimeBlockById(blockId);
  if (!block) {
    return { error: "Invalid time block." };
  }

  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.specialty !== specialtyName) {
    return { error: "Please choose a doctor for this specialty." };
  }

  const scheduledAt = new Date(
    clinicMidnightForYMD(year, month, day).getTime() + toMinutes(block.startTime) * 60 * 1000
  );

  if (await isDoctorOnLeave(doctor.id, scheduledAt)) {
    return { error: "This doctor is unavailable on the selected date. Please choose another doctor or day." };
  }
  if (!(await isDoctorAvailableForRange(doctor, scheduledAt, blockDurationMinutes(block)))) {
    return {
      error: "This doctor doesn't work the full selected time block. Please choose another doctor or block.",
    };
  }

  return submitAppointmentRequest(
    patientId,
    doctor.id,
    scheduledAt,
    reason || undefined,
    blockDurationMinutes(block),
    clinicServiceId,
    { specialtyName, capacityPerSlot: specialty.capacityPerSlot },
    { mode: "BLOCK_CAPACITY" }
  );
}
