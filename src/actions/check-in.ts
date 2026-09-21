"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { redirect } from "@/i18n/navigation";
import { generatePatientCode } from "@/lib/patients";
import { logActivity } from "@/lib/audit";
import { createLabOrderForLinkedService, createLabOrderFromSelectedTests } from "@/actions/appointments";
import { getClinicHoursForDate, clinicLocalMinutes, clinicMidnight, clinicWeekday, toMinutes, formatTime } from "@/lib/clinic-hours";
import { generateTimeBlocks, blockContainingMinuteOfDay, nearestBlock, blockDurationMinutes, blockCapacity } from "@/lib/time-blocks";
import { isBlockSlotAvailable } from "@/lib/scheduling";
import {
  isDoctorOnLeave,
  isWorkingDay,
  getDoctorShiftsForDate,
  isWithinShiftRanges,
  formatShiftRanges,
  WEEKDAY_LABELS,
} from "@/lib/doctor-availability";

const registerSchema = z.object({
  // Set when registering a walk-in for an already-registered patient (found
  // via search on /staff/check-in) — skips creating a new Patient row.
  // Otherwise name is required and a new patient is created, same as before.
  patientId: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  // Either doctorId (a real doctor) or specialtyName (a SERVICE_CAPACITY
  // specialty like Lab Visit — the doctor is auto-assigned server-side).
  doctorId: z.string().optional(),
  specialtyName: z.string().optional(),
  clinicServiceId: z.string().optional(),
  reason: z.string().optional(),
  testIds: z.array(z.string().min(1)).optional(),
});

export type RegisterAndCheckInState = { error?: string };

export async function registerAndCheckIn(
  _prevState: RegisterAndCheckInState,
  formData: FormData
): Promise<RegisterAndCheckInState> {
  const session = await requireRole(STAFF_ROLES);

  const parsed = registerSchema.safeParse({
    patientId: formData.get("patientId") || undefined,
    name: formData.get("name") || undefined,
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    gender: formData.get("gender") || undefined,
    doctorId: formData.get("doctorId") || undefined,
    specialtyName: formData.get("specialtyName") || undefined,
    clinicServiceId: formData.get("clinicServiceId") || undefined,
    reason: formData.get("reason") || undefined,
    testIds: formData.getAll("testIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { patientId, name, phone, dob, gender, clinicServiceId, reason } = parsed.data;
  if (!patientId && !name) {
    return { error: "Enter the patient's name." };
  }

  let existingPatient: Awaited<ReturnType<typeof prisma.patient.findUnique>> = null;
  if (patientId) {
    existingPatient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!existingPatient) return { error: "Patient not found." };

    const activeApptToday = await prisma.appointment.findFirst({
      where: {
        patientId,
        status: { in: ["REQUESTED", "CONFIRMED", "CHECKED_IN"] },
        scheduledAt: { gte: clinicMidnight(new Date()), lt: new Date(clinicMidnight(new Date()).getTime() + 24 * 60 * 60 * 1000) },
      },
    });
    if (activeApptToday) {
      return { error: "This patient already has an active appointment today. Check them in from there instead." };
    }
  }

  let doctorId: string;
  let doctor: Awaited<ReturnType<typeof prisma.doctorProfile.findUniqueOrThrow>>;
  let specialty: Awaited<ReturnType<typeof prisma.specialty.findUnique>> = null;

  if (parsed.data.specialtyName) {
    specialty = await prisma.specialty.findUnique({ where: { name: parsed.data.specialtyName } });
    if (!specialty || specialty.bookingMode !== "SERVICE_CAPACITY") {
      return { error: "This specialty isn't set up for service-based walk-ins." };
    }
    if (!clinicServiceId) {
      return { error: "Select which service or lab test this visit is for" };
    }
    const assignedDoctor = await prisma.doctorProfile.findFirst({
      where: { specialty: specialty.name },
      orderBy: { id: "asc" },
    });
    if (!assignedDoctor) {
      return { error: "No staff are set up for this specialty yet. Please contact the clinic." };
    }
    doctor = assignedDoctor;
    doctorId = assignedDoctor.id;
  } else {
    if (!parsed.data.doctorId) return { error: "Please choose a doctor." };
    doctorId = parsed.data.doctorId;
    doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctorId } });
    specialty = doctor.specialty
      ? await prisma.specialty.findUnique({ where: { name: doctor.specialty } })
      : null;
  }

  const clinicService = clinicServiceId
    ? await prisma.clinicService.findUnique({ where: { id: clinicServiceId } })
    : null;

  const now = new Date();

  // Whichever doctor ends up on this walk-in (directly picked, or
  // auto-assigned for a shared-capacity service) must actually be around
  // today — same leave check every other booking path already applies
  // (see isDoctorOnLeave usage in createAppointment/submitAppointmentRequest).
  if (await isDoctorOnLeave(doctorId, now)) {
    return { error: "This doctor is on leave today and can't accept walk-ins. Please choose another doctor." };
  }

  // A block-mode (or shared-capacity service, e.g. Lab Visit) walk-in is
  // always "right now" — resolve whichever of today's generated blocks
  // contains the current clinic-local time (clamped to the nearest one if
  // outside all of them, e.g. before the clinic's first block), then
  // capacity-check it the same way the booking wizard does.
  let scheduledAt = now;
  let durationMinutes: number | undefined = clinicService?.durationMinutes;
  if (specialty?.bookingMode === "BLOCK_CAPACITY" || specialty?.bookingMode === "SERVICE_CAPACITY") {
    const clinicHours = await getClinicHoursForDate(now);
    if (!clinicHours.isOpen) {
      return { error: "The clinic is closed today." };
    }
    const blocks = generateTimeBlocks(clinicHours.openTime, clinicHours.closeTime);
    const minutesNow = clinicLocalMinutes(now);
    const block = blockContainingMinuteOfDay(blocks, minutesNow) ?? nearestBlock(blocks, minutesNow);
    if (!block) {
      return { error: "No bookable time blocks configured for today." };
    }
    const dayStart = clinicMidnight(now);
    scheduledAt = new Date(dayStart.getTime() + toMinutes(block.startTime) * 60 * 1000);
    durationMinutes = blockDurationMinutes(block);

    const capacity = blockCapacity(block, specialty.capacityPerSlot);
    const { available } = await isBlockSlotAvailable(specialty.name, capacity, scheduledAt);
    if (!available) {
      return {
        error: `This time block is at capacity (${capacity} patients). Please try again shortly.`,
      };
    }
  } else {
    // A directly-picked doctor (the common case — no shared time-block
    // capacity involved) must actually be working right now, same as a
    // staff-booked appointment would require.
    if (!isWorkingDay(doctor.workingDays, now)) {
      return {
        error: `This doctor doesn't see patients on ${WEEKDAY_LABELS[clinicWeekday(now)]}s. Please choose another doctor.`,
      };
    }
    const shifts = await getDoctorShiftsForDate(doctorId, now);
    if (!isWithinShiftRanges(now, shifts)) {
      return {
        error: `This doctor is only available ${formatShiftRanges(shifts, formatTime)} today. Please choose another doctor.`,
      };
    }
  }

  const { appointment } = await prisma.$transaction(async (tx) => {
    const patient =
      existingPatient ??
      (await tx.patient.create({
        data: {
          name: name!,
          phone,
          gender,
          dob: dob ? new Date(dob) : undefined,
          patientCode: await generatePatientCode(tx),
        },
      }));

    const appointment = await tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId,
        clinicServiceId: clinicService?.id,
        scheduledAt,
        durationMinutes,
        status: "CHECKED_IN",
        checkedInAt: now,
        reason: reason ?? clinicService?.name,
      },
      include: { clinicService: true },
    });

    return { appointment };
  });

  await createLabOrderForLinkedService(appointment);
  await createLabOrderFromSelectedTests(appointment, parsed.data.testIds ?? []);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Registered and checked in a walk-in patient",
    target: `Appointment ${appointment.id}`,
  });

  revalidatePath("/staff/queue");
  revalidatePath("/staff/appointments");
  revalidatePath("/staff/patients");
  revalidatePath("/staff");

  const locale = await getLocale();
  return redirect({ href: `/staff/appointments/${appointment.id}`, locale });
}
