"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, UnauthorizedError } from "@/lib/authz";
import {
  findConflictingAppointment,
  isResourceSlotAvailable,
  isBlockSlotAvailable,
  APPOINTMENT_SLOT_MINUTES,
  MAX_APPOINTMENT_SLOTS,
  MIN_BOOKING_LEAD_MINUTES,
} from "@/lib/scheduling";
import {
  getClinicHoursForDate,
  isWithinOpeningHours,
  formatTime,
  clinicWeekday,
  clinicMidnight,
  clinicMidnightForYMD,
  toMinutes,
} from "@/lib/clinic-hours";
import { isWithinSelfCheckInWindow } from "@/lib/queue";
import {
  isDoctorOnLeave,
  isWorkingDay,
  isDoctorAvailableForRange,
  getDoctorShiftsForDate,
  isRangeWithinShiftRanges,
  formatShiftRanges,
  WEEKDAY_LABELS,
} from "@/lib/doctor-availability";
import { notifyPatient, notifyStaff, notifyDoctor } from "@/lib/telegram";
import { createNotification, notifyStaffUsers } from "@/lib/notifications";
import { notifyWaitlistOfOpening } from "@/actions/waitlist";
import { logActivity } from "@/lib/audit";
import { TIME_BLOCKS, blockDurationMinutes, getTimeBlockById } from "@/lib/time-blocks";

const CONFLICT_MESSAGE = `This doctor already has an appointment within ${APPOINTMENT_SLOT_MINUTES} minutes of that time.`;
const CAPACITY_CONFLICT_MESSAGE = "That slot just filled up. Please pick a different time, or join the waitlist.";

const bookingSchema = z.object({
  patientId: z.string().min(1),
  // Either doctorId (a real doctor, DOCTOR_CALENDAR/BLOCK_CAPACITY) or
  // specialtyName+clinicServiceId (SERVICE_CAPACITY, e.g. Lab Visit — the
  // doctor is auto-assigned server-side, there's no real doctor to pick).
  doctorId: z.string().optional(),
  specialtyName: z.string().optional(),
  clinicServiceId: z.string().optional(),
  resourceDate: z.string().optional(),
  resourceTime: z.string().optional(),
  scheduledAt: z.string().optional(),
  blockDate: z.string().optional(),
  blockId: z.string().optional(),
  reason: z.string().optional(),
  repeatWeekly: z.string().optional(),
  occurrences: z.coerce.number().int().min(2).max(12).optional(),
});

export type AppointmentFormState = {
  error?: string;
  success?: boolean;
  conflict?: { doctorId: string; scheduledAt: string; reason?: string };
  createdCount?: number;
  skippedDates?: string[];
};

export async function createAppointment(
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  await requireRole(["ADMIN", "STAFF", "DOCTOR"]);

  const parsed = bookingSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId") || undefined,
    specialtyName: formData.get("specialtyName") || undefined,
    clinicServiceId: formData.get("clinicServiceId") || undefined,
    resourceDate: formData.get("resourceDate") || undefined,
    resourceTime: formData.get("resourceTime") || undefined,
    scheduledAt: formData.get("scheduledAt") || undefined,
    blockDate: formData.get("blockDate") || undefined,
    blockId: formData.get("blockId") || undefined,
    reason: formData.get("reason") || undefined,
    repeatWeekly: formData.get("repeatWeekly") || undefined,
    occurrences: formData.get("occurrences") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const isServiceBooking = !!parsed.data.specialtyName;

  let doctorId: string;
  let doctor: Awaited<ReturnType<typeof prisma.doctorProfile.findUniqueOrThrow>> | null = null;
  let specialty: Awaited<ReturnType<typeof prisma.specialty.findUnique>> = null;
  let isBlockMode = false;
  let baseDate: Date;
  let durationMinutes: number | undefined;
  let clinicServiceId: string | undefined;

  if (isServiceBooking) {
    specialty = await prisma.specialty.findUnique({ where: { name: parsed.data.specialtyName! } });
    if (!specialty || specialty.bookingMode !== "SERVICE_CAPACITY") {
      return { error: "This specialty isn't set up for service-based booking." };
    }
    if (!parsed.data.clinicServiceId) return { error: "Please choose a service." };
    const service = await prisma.clinicService.findUnique({ where: { id: parsed.data.clinicServiceId } });
    if (!service || service.specialty !== specialty.name) {
      return { error: "Please choose a valid service." };
    }
    // No real doctor to pick for a shared-capacity specialty — assigned
    // deterministically (by id), same as the patient booking flow.
    const assignedDoctor = await prisma.doctorProfile.findFirst({
      where: { specialty: specialty.name },
      orderBy: { id: "asc" },
    });
    if (!assignedDoctor) {
      return { error: "No staff are set up for this specialty yet. Please contact the clinic." };
    }
    if (!parsed.data.resourceDate || !parsed.data.resourceTime) {
      return { error: "Please choose a date and time." };
    }
    const [y, m, d] = parsed.data.resourceDate.split("-").map(Number);
    baseDate = new Date(
      clinicMidnightForYMD(y, m, d).getTime() + toMinutes(parsed.data.resourceTime) * 60 * 1000
    );
    durationMinutes = service.durationMinutes;
    clinicServiceId = service.id;
    doctorId = assignedDoctor.id;
  } else {
    if (!parsed.data.doctorId) return { error: "Please choose a doctor." };
    doctorId = parsed.data.doctorId;
    doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctorId } });
    specialty = doctor.specialty
      ? await prisma.specialty.findUnique({ where: { name: doctor.specialty } })
      : null;
    isBlockMode = specialty?.bookingMode === "BLOCK_CAPACITY";

    if (isBlockMode) {
      if (!parsed.data.blockDate || !parsed.data.blockId) {
        return { error: "Please choose a date and time block." };
      }
      const block = getTimeBlockById(parsed.data.blockId);
      if (!block) return { error: "Invalid time block." };
      const [y, m, d] = parsed.data.blockDate.split("-").map(Number);
      baseDate = new Date(clinicMidnightForYMD(y, m, d).getTime() + toMinutes(block.startTime) * 60 * 1000);
      durationMinutes = blockDurationMinutes(block);
    } else {
      if (!parsed.data.scheduledAt) return { error: "Please choose a date and time." };
      baseDate = new Date(parsed.data.scheduledAt);
    }
  }

  const isRecurring = !!parsed.data.repeatWeekly;
  const occurrenceCount = isRecurring ? Math.max(2, parsed.data.occurrences ?? 4) : 1;

  const skippedDates: string[] = [];
  let createdCount = 0;

  for (let i = 0; i < occurrenceCount; i++) {
    const occurrenceDate = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);

    let onLeave = false;
    let conflict: unknown = null;
    let unavailableReason: string | null = null;

    if (isServiceBooking && specialty) {
      // Shared-capacity specialties skip the per-doctor leave/hours checks
      // entirely, same as the patient-facing resourceCapacity path.
      const available = await isResourceSlotAvailable(
        { specialtyName: specialty.name, capacityPerSlot: specialty.capacityPerSlot },
        occurrenceDate,
        durationMinutes
      );
      if (!available) {
        conflict = true;
        unavailableReason = CAPACITY_CONFLICT_MESSAGE;
      }
    } else {
      onLeave = await isDoctorOnLeave(doctorId, occurrenceDate);
      if (!onLeave) {
        if (isBlockMode && specialty && doctor) {
          if (!(await isDoctorAvailableForRange(doctor, occurrenceDate, durationMinutes!))) {
            conflict = true;
            unavailableReason = "This doctor doesn't work the full selected time block.";
          } else {
            const { available } = await isBlockSlotAvailable(
              specialty.name,
              specialty.capacityPerSlot,
              occurrenceDate
            );
            if (!available) {
              conflict = true;
              unavailableReason = CAPACITY_CONFLICT_MESSAGE;
            }
          }
        } else {
          conflict = await findConflictingAppointment(doctorId, occurrenceDate);
        }
      }
    }

    if (onLeave || conflict) {
      if (!isRecurring) {
        return { error: onLeave ? "This doctor is on leave on the selected date." : (unavailableReason ?? CONFLICT_MESSAGE) };
      }
      skippedDates.push(occurrenceDate.toLocaleDateString());
      continue;
    }

    await prisma.appointment.create({
      data: {
        patientId: parsed.data.patientId,
        doctorId,
        scheduledAt: occurrenceDate,
        durationMinutes,
        reason: parsed.data.reason,
        status: "CONFIRMED",
        clinicServiceId,
      },
    });
    createdCount++;
  }

  revalidatePath("/staff/appointments");
  revalidatePath("/doctor/appointments");

  if (createdCount === 0) {
    return { error: "None of the requested weekly occurrences could be booked (conflicts or leave days)." };
  }

  return isRecurring ? { success: true, createdCount, skippedDates } : { success: true };
}

const requestSchema = z.object({
  doctorId: z.string().min(1),
  scheduledAt: z.string().min(1),
  reason: z.string().optional(),
});

export async function requestAppointment(
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const parsed = requestSchema.safeParse({
    doctorId: formData.get("doctorId"),
    scheduledAt: formData.get("scheduledAt"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  return submitAppointmentRequest(
    patientId,
    parsed.data.doctorId,
    new Date(parsed.data.scheduledAt),
    parsed.data.reason
  );
}

// Shared by the free-form request form (which parses a datetime-local string
// in the browser's own timezone) and the slot-picker booking wizard (which
// computes `scheduledAt` precisely in clinic-local time server-side) — both
// end up here once they have a concrete doctorId + absolute instant.
export async function submitAppointmentRequest(
  patientId: string,
  doctorId: string,
  scheduledAt: Date,
  reason?: string,
  durationMinutes: number = APPOINTMENT_SLOT_MINUTES,
  clinicServiceId?: string | null,
  // Set for "book by service" specialties (e.g. Laboratory): availability is
  // governed by clinic hours + shared capacity rather than this particular
  // doctor's own calendar, so the doctor-specific leave/hours/conflict checks
  // below are skipped in favor of a capacity check.
  resourceCapacity?: { specialtyName: string; capacityPerSlot: number } | null,
  // Set for BLOCK_CAPACITY bookings, where durationMinutes is a fixed block
  // length (120/180) rather than a multiple of APPOINTMENT_SLOT_MINUTES.
  bookingContext?: { mode: "BLOCK_CAPACITY" } | null
): Promise<AppointmentFormState> {
  if (bookingContext?.mode === "BLOCK_CAPACITY") {
    const validBlockDurations = TIME_BLOCKS.map(blockDurationMinutes);
    if (!validBlockDurations.includes(durationMinutes)) {
      return { error: "Invalid appointment duration." };
    }
  } else if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < APPOINTMENT_SLOT_MINUTES ||
    durationMinutes > MAX_APPOINTMENT_SLOTS * APPOINTMENT_SLOT_MINUTES ||
    durationMinutes % APPOINTMENT_SLOT_MINUTES !== 0
  ) {
    return { error: "Invalid appointment duration." };
  }
  if (scheduledAt.getTime() < Date.now() + MIN_BOOKING_LEAD_MINUTES * 60 * 1000) {
    return {
      error: `Online booking needs at least ${MIN_BOOKING_LEAD_MINUTES} minutes' notice. If you need to be seen right now, please visit the clinic for walk-in registration.`,
    };
  }

  const scheduledEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const dayStart = clinicMidnight(scheduledAt);

  const clinicHours = await getClinicHoursForDate(scheduledAt);
  const clinicCloseInstant = new Date(dayStart.getTime() + toMinutes(clinicHours.closeTime) * 60 * 1000);
  if (
    !clinicHours.isOpen ||
    !isWithinOpeningHours(scheduledAt, clinicHours.openTime, clinicHours.closeTime) ||
    scheduledEnd.getTime() > clinicCloseInstant.getTime()
  ) {
    return {
      error: clinicHours.isOpen
        ? `Please choose a time between ${formatTime(clinicHours.openTime)} and ${formatTime(clinicHours.closeTime)} that leaves room for the full ${durationMinutes}-minute visit.`
        : "The clinic is closed on the selected day. Please choose another day.",
    };
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
  });
  if (!doctor) {
    return { error: "Doctor not found" };
  }

  // Trust but verify: the service picker only ever sends an id it just fetched,
  // but validate anyway rather than let a stale/tampered id hit the FK constraint.
  let clinicService: { id: string; name: string } | null = null;
  if (clinicServiceId) {
    const found = await prisma.clinicService.findUnique({
      where: { id: clinicServiceId },
      select: { id: true, name: true, durationMinutes: true },
    });
    if (found && durationMinutes < found.durationMinutes) {
      return {
        error: `${found.name} needs at least ${found.durationMinutes} minutes — please reserve more time.`,
      };
    }
    clinicService = found;
  }

  if (resourceCapacity) {
    const available = await isResourceSlotAvailable(resourceCapacity, scheduledAt, durationMinutes);
    if (!available) {
      return {
        error: CAPACITY_CONFLICT_MESSAGE,
        conflict: {
          doctorId,
          scheduledAt: scheduledAt.toISOString(),
          reason,
        },
      };
    }
  } else {
    const onLeave = await isDoctorOnLeave(doctor.id, scheduledAt);
    if (onLeave) {
      return { error: "This doctor is unavailable on the selected date. Please choose another day." };
    }
    if (!isWorkingDay(doctor.workingDays, scheduledAt)) {
      return {
        error: `This doctor doesn't see patients on ${WEEKDAY_LABELS[clinicWeekday(scheduledAt)]}s. Please choose another day.`,
      };
    }
    const shifts = await getDoctorShiftsForDate(doctor.id, scheduledAt);
    if (!isRangeWithinShiftRanges(scheduledAt, durationMinutes, shifts)) {
      return {
        error:
          shifts.length > 0
            ? `Please choose a time within this doctor's working hours (${formatShiftRanges(shifts, formatTime)}) that leaves room for the full ${durationMinutes}-minute visit.`
            : `Please choose a time that leaves room for the full ${durationMinutes}-minute visit.`,
      };
    }

    const conflict = await findConflictingAppointment(doctorId, scheduledAt, durationMinutes);
    if (conflict) {
      return {
        error: CONFLICT_MESSAGE,
        conflict: {
          doctorId,
          scheduledAt: scheduledAt.toISOString(),
          reason,
        },
      };
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      scheduledAt,
      durationMinutes,
      reason: reason || clinicService?.name,
      status: "REQUESTED",
      clinicServiceId: clinicService?.id,
    },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  await notifyStaff(
    `📅 New appointment request: ${appointment.patient.name} with ${appointment.doctor.user.name} at ${scheduledAt.toLocaleString()}.`
  );

  const requestSummary = `${appointment.patient.name} requested an appointment with ${appointment.doctor.user.name} on ${scheduledAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })} at ${scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;

  const staffRecipients = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] }, active: true, notifyNewAppointments: true },
    select: { id: true },
  });
  await notifyStaffUsers({
    userIds: staffRecipients.map((u) => u.id),
    category: "APPOINTMENT",
    tone: "INFO",
    title: "New Appointment Request",
    body: requestSummary,
    href: `/staff/appointments/${appointment.id}`,
    relatedId: `appt-request-${appointment.id}`,
  });
  if (doctor.notifyNewAppointments) {
    await notifyStaffUsers({
      userIds: [doctor.userId],
      category: "APPOINTMENT",
      tone: "INFO",
      title: "New Appointment Request",
      body: requestSummary,
      href: `/doctor/appointments/${appointment.id}`,
      relatedId: `appt-request-${appointment.id}`,
    });
    await notifyDoctor(doctor.id, `📅 New appointment request: ${requestSummary}`);
  }

  revalidatePath("/portal/appointments");
  return { success: true };
}

async function assertCanManage(appointmentId: string) {
  const session = await requireRole(["ADMIN", "STAFF", "DOCTOR"]);
  if (session.user.role === "DOCTOR") {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment || appointment.doctorId !== session.user.doctorId) {
      throw new UnauthorizedError("Not your appointment");
    }
  }
}

export async function confirmAppointment(appointmentId: string) {
  await assertCanManage(appointmentId);
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED" },
    include: { doctor: { include: { user: true } } },
  });
  await notifyPatient(
    appointment.patientId,
    `✅ Your appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} has been confirmed.\n\nReply CANCEL to cancel it.`
  );
  await createNotification({
    patientId: appointment.patientId,
    category: "APPOINTMENT",
    tone: "SUCCESS",
    title: "Appointment Confirmed",
    body: `Your appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString(undefined, { month: "long", day: "numeric" })} at ${appointment.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} has been confirmed.`,
    href: `/portal/appointments/${appointment.id}`,
    relatedId: `appt-confirm-${appointment.id}`,
  });
  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/doctor/appointments");
  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/consultations");
  revalidatePath("/portal/notifications");
}

const rescheduleSchema = z.object({
  scheduledAt: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

export type RescheduleAppointmentState = { error?: string; success?: boolean };

export async function rescheduleAppointment(
  appointmentId: string,
  _prevState: RescheduleAppointmentState,
  formData: FormData
): Promise<RescheduleAppointmentState> {
  const session = await requireSession();
  const role = session.user.role;

  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!existing) return { error: "Appointment not found" };

  let actorIsPatient = false;
  if (role === "ADMIN" || role === "STAFF") {
    // staff can reschedule any appointment, no restriction
  } else if (role === "DOCTOR") {
    if (existing.doctorId !== session.user.doctorId) {
      throw new UnauthorizedError("Not your appointment");
    }
    if (existing.status !== "REQUESTED" && existing.status !== "CONFIRMED") {
      return { error: "This appointment can no longer be rescheduled" };
    }
  } else if (role === "PATIENT") {
    if (existing.patientId !== session.user.patientId) {
      throw new UnauthorizedError("Not your appointment");
    }
    if (existing.status !== "REQUESTED" && existing.status !== "CONFIRMED") {
      return { error: "This appointment can no longer be rescheduled" };
    }
    actorIsPatient = true;
  } else {
    throw new UnauthorizedError("Not allowed to reschedule appointments");
  }

  const parsed = rescheduleSchema.safeParse({
    scheduledAt: formData.get("scheduledAt"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: "Please choose a valid date and time" };
  }
  const scheduledAt = parsed.data.scheduledAt;

  if (actorIsPatient) {
    if (scheduledAt.getTime() < Date.now() + MIN_BOOKING_LEAD_MINUTES * 60 * 1000) {
      return {
        error: `Online rescheduling needs at least ${MIN_BOOKING_LEAD_MINUTES} minutes' notice. If you need to be seen sooner, please visit the clinic for walk-in registration.`,
      };
    }
  } else if (scheduledAt.getTime() <= Date.now()) {
    return { error: "Please choose a time in the future" };
  }

  const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: existing.doctorId } });
  const specialty = doctor.specialty
    ? await prisma.specialty.findUnique({ where: { name: doctor.specialty } })
    : null;
  const resourceCapacity =
    specialty?.bookingMode === "SERVICE_CAPACITY" && specialty.capacityPerSlot
      ? { specialtyName: specialty.name, capacityPerSlot: specialty.capacityPerSlot }
      : null;

  const dayStart = clinicMidnight(scheduledAt);
  const clinicHours = await getClinicHoursForDate(scheduledAt);
  const scheduledEnd = new Date(scheduledAt.getTime() + existing.durationMinutes * 60 * 1000);
  const clinicCloseInstant = new Date(dayStart.getTime() + toMinutes(clinicHours.closeTime) * 60 * 1000);
  if (
    !clinicHours.isOpen ||
    !isWithinOpeningHours(scheduledAt, clinicHours.openTime, clinicHours.closeTime) ||
    scheduledEnd.getTime() > clinicCloseInstant.getTime()
  ) {
    return {
      error: clinicHours.isOpen
        ? `Please choose a time between ${formatTime(clinicHours.openTime)} and ${formatTime(clinicHours.closeTime)} that leaves room for the full ${existing.durationMinutes}-minute visit.`
        : "The clinic is closed on the selected day. Please choose another day.",
    };
  }

  if (resourceCapacity) {
    const available = await isResourceSlotAvailable(
      resourceCapacity,
      scheduledAt,
      existing.durationMinutes,
      appointmentId
    );
    if (!available) return { error: CONFLICT_MESSAGE };
  } else {
    const onLeave = await isDoctorOnLeave(doctor.id, scheduledAt);
    if (onLeave) {
      return { error: "This doctor is unavailable on the selected date. Please choose another day." };
    }
    if (!isWorkingDay(doctor.workingDays, scheduledAt)) {
      return {
        error: `This doctor doesn't see patients on ${WEEKDAY_LABELS[clinicWeekday(scheduledAt)]}s. Please choose another day.`,
      };
    }
    const shifts = await getDoctorShiftsForDate(doctor.id, scheduledAt);
    if (!isRangeWithinShiftRanges(scheduledAt, existing.durationMinutes, shifts)) {
      return {
        error:
          shifts.length > 0
            ? `Please choose a time within this doctor's working hours (${formatShiftRanges(shifts, formatTime)}) that leaves room for the full ${existing.durationMinutes}-minute visit.`
            : `Please choose a time that leaves room for the full ${existing.durationMinutes}-minute visit.`,
      };
    }
    const conflict = await findConflictingAppointment(
      doctor.id,
      scheduledAt,
      existing.durationMinutes,
      appointmentId
    );
    if (conflict) return { error: CONFLICT_MESSAGE };
  }

  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { scheduledAt },
    include: { doctor: { include: { user: true } }, patient: true },
  });

  const reason = parsed.data.reason?.trim() || undefined;
  const newTimeLabel = `${appointment.scheduledAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })} at ${appointment.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

  await notifyPatient(
    appointment.patientId,
    `🔄 Your appointment with ${appointment.doctor.user.name} has been rescheduled to ${appointment.scheduledAt.toLocaleString()}.${reason ? `\n\nReason: ${reason}` : ""}`
  );
  await createNotification({
    patientId: appointment.patientId,
    category: "APPOINTMENT",
    tone: "INFO",
    title: "Appointment Rescheduled",
    body: `Your appointment with ${appointment.doctor.user.name} has been moved to ${newTimeLabel}.${reason ? ` Reason: ${reason}` : ""}`,
    href: `/portal/appointments/${appointment.id}`,
    relatedId: `appt-reschedule-${appointment.id}-${appointment.updatedAt.getTime()}`,
  });

  if (role === "DOCTOR") {
    const staffRecipients = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, active: true, notifyNewAppointments: true },
      select: { id: true },
    });
    await notifyStaffUsers({
      userIds: staffRecipients.map((u) => u.id),
      category: "APPOINTMENT",
      tone: "INFO",
      title: "Appointment Rescheduled by Doctor",
      body: `Dr. ${appointment.doctor.user.name} moved ${appointment.patient.name}'s appointment to ${newTimeLabel}.${reason ? ` Reason: ${reason}` : ""}`,
      href: `/staff/appointments/${appointment.id}`,
      relatedId: `appt-reschedule-${appointment.id}-${appointment.updatedAt.getTime()}`,
    });
  } else if (actorIsPatient) {
    const rescheduleSummary = `${appointment.patient.name} rescheduled their appointment with ${appointment.doctor.user.name} to ${newTimeLabel} via the patient portal.${reason ? ` Reason: ${reason}` : ""}`;
    const staffRecipients = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, active: true, notifyNewAppointments: true },
      select: { id: true },
    });
    await notifyStaffUsers({
      userIds: staffRecipients.map((u) => u.id),
      category: "APPOINTMENT",
      tone: "INFO",
      title: "Appointment Rescheduled",
      body: rescheduleSummary,
      href: `/staff/appointments/${appointment.id}`,
      relatedId: `appt-reschedule-${appointment.id}-${appointment.updatedAt.getTime()}`,
    });
    if (appointment.doctor.notifyNewAppointments) {
      await notifyStaffUsers({
        userIds: [appointment.doctor.userId],
        category: "APPOINTMENT",
        tone: "INFO",
        title: "Appointment Rescheduled",
        body: rescheduleSummary,
        href: `/doctor/appointments/${appointment.id}`,
        relatedId: `appt-reschedule-${appointment.id}-${appointment.updatedAt.getTime()}`,
      });
      await notifyDoctor(appointment.doctorId, `🔄 ${rescheduleSummary}`);
    }
  } else if (appointment.doctor.notifyNewAppointments) {
    const staffRescheduleSummary = `${appointment.patient.name}'s appointment was moved to ${newTimeLabel} by ${session.user.name ?? "staff"}.${reason ? ` Reason: ${reason}` : ""}`;
    await notifyStaffUsers({
      userIds: [appointment.doctor.userId],
      category: "APPOINTMENT",
      tone: "INFO",
      title: "Appointment Rescheduled",
      body: staffRescheduleSummary,
      href: `/doctor/appointments/${appointment.id}`,
      relatedId: `appt-reschedule-${appointment.id}-${appointment.updatedAt.getTime()}`,
    });
    await notifyDoctor(appointment.doctorId, `🔄 ${staffRescheduleSummary}`);
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Rescheduled an appointment",
    target: `${appointment.patient.name} with ${appointment.doctor.user.name} → ${newTimeLabel}${reason ? ` (${reason})` : ""}`,
  });

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/staff/activity-log");
  revalidatePath("/doctor/appointments");
  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/consultations");
  revalidatePath("/portal/appointments");
  revalidatePath(`/portal/appointments/${appointmentId}`);
  revalidatePath("/portal/notifications");
  return { success: true };
}

// Booking (or walk-in-registering into) a service linked to a lab test
// (e.g. under "Lab Visit") implies ordering that test — create the lab
// order automatically the moment the appointment becomes CHECKED_IN, from
// whichever path got it there, so staff never have to re-enter what was
// already selected.
export async function createLabOrderForLinkedService(appointment: {
  id: string;
  patientId: string;
  doctorId: string;
  clinicService: { labTestId: string | null } | null;
}) {
  if (!appointment.clinicService?.labTestId) return;

  const existingOrder = await prisma.labOrder.findFirst({
    where: { appointmentId: appointment.id },
  });
  if (existingOrder) return;

  const labTest = await prisma.labTest.findUnique({
    where: { id: appointment.clinicService.labTestId },
  });
  if (!labTest) return;

  await prisma.labOrder.create({
    data: {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentId: appointment.id,
      items: { create: [{ labTestId: labTest.id, price: labTest.price }] },
    },
  });
  revalidatePath("/staff/lab");
}

export async function checkInAppointment(appointmentId: string) {
  const session = await requireSession();
  const role = session.user.role;

  if (role === "ADMIN" || role === "STAFF") {
    // staff can check in any confirmed appointment, no time restriction
  } else if (role === "PATIENT") {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment || appointment.patientId !== session.user.patientId) {
      throw new UnauthorizedError("Not your appointment");
    }
    if (appointment.status !== "CONFIRMED") {
      throw new UnauthorizedError("Appointment is not confirmed");
    }
    if (!isWithinSelfCheckInWindow(appointment.scheduledAt, appointment.durationMinutes)) {
      throw new UnauthorizedError("Outside the self check-in window");
    }
  } else {
    throw new UnauthorizedError("Not allowed to check in appointments");
  }

  const checkedIn = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
    include: { doctor: true, patient: true, clinicService: true },
  });

  await createLabOrderForLinkedService(checkedIn);

  if (checkedIn.doctor.notifyPatientWaiting) {
    await notifyStaffUsers({
      userIds: [checkedIn.doctor.userId],
      category: "APPOINTMENT",
      tone: "INFO",
      title: "Patient Waiting",
      body: `${checkedIn.patient.name} has checked in and is waiting for their appointment.`,
      href: `/doctor/appointments/${checkedIn.id}`,
      relatedId: `appt-waiting-${checkedIn.id}-${checkedIn.checkedInAt?.getTime()}`,
    });
    await notifyDoctor(
      checkedIn.doctorId,
      `🙋 ${checkedIn.patient.name} has checked in and is waiting for their appointment.`
    );
  }

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/staff");
  revalidatePath("/doctor/appointments");
  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/consultations");
  revalidatePath("/portal/appointments");
  revalidatePath("/portal");
}

export async function markNoShow(appointmentId: string) {
  const session = await requireRole(["ADMIN", "DOCTOR", "STAFF"]);
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment) throw new UnauthorizedError("Appointment not found");
  if (session.user.role === "DOCTOR" && appointment.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your appointment");
  }
  if (appointment.status !== "CONFIRMED") {
    throw new UnauthorizedError("Only a confirmed appointment can be marked as a no-show");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "NO_SHOW" },
  });

  await notifyWaitlistOfOpening(appointment.doctorId, appointment.scheduledAt);

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/doctor/appointments");
  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/consultations");
}

export async function cancelAppointment(appointmentId: string) {
  const session = await requireSession();
  const role = session.user.role;
  let cancelledByPatient = false;

  if (role === "ADMIN" || role === "STAFF") {
    // staff can cancel any appointment, no restriction
  } else if (role === "DOCTOR") {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment || appointment.doctorId !== session.user.doctorId) {
      throw new UnauthorizedError("Not your appointment");
    }
  } else if (role === "PATIENT") {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment || appointment.patientId !== session.user.patientId) {
      throw new UnauthorizedError("Not your appointment");
    }
    if (appointment.status !== "REQUESTED" && appointment.status !== "CONFIRMED") {
      throw new UnauthorizedError("This appointment can no longer be cancelled");
    }
    cancelledByPatient = true;
  } else {
    throw new UnauthorizedError("Not allowed to cancel appointments");
  }

  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
    include: { doctor: { include: { user: true } }, patient: true },
  });

  if (cancelledByPatient) {
    await notifyStaff(
      `❌ ${appointment.patient.name} cancelled their appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} via the patient portal.`
    );
    const cancelSummary = `${appointment.patient.name} cancelled their appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })} at ${appointment.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
    const staffRecipients = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, active: true, notifyNewAppointments: true },
      select: { id: true },
    });
    await notifyStaffUsers({
      userIds: staffRecipients.map((u) => u.id),
      category: "APPOINTMENT",
      tone: "WARNING",
      title: "Appointment Cancelled",
      body: cancelSummary,
      href: `/staff/appointments/${appointment.id}`,
      relatedId: `appt-cancel-${appointment.id}`,
    });
    if (appointment.doctor.notifyAppointmentCancelled) {
      await notifyStaffUsers({
        userIds: [appointment.doctor.userId],
        category: "APPOINTMENT",
        tone: "WARNING",
        title: "Appointment Cancelled",
        body: cancelSummary,
        href: `/doctor/appointments/${appointment.id}`,
        relatedId: `appt-cancel-${appointment.id}`,
      });
      await notifyDoctor(appointment.doctorId, `❌ ${cancelSummary}`);
    }
  } else {
    await notifyPatient(
      appointment.patientId,
      `❌ Your appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} has been cancelled.`
    );

    if (role === "DOCTOR") {
      const cancelSummary = `Dr. ${appointment.doctor.user.name} cancelled the appointment with ${appointment.patient.name} on ${appointment.scheduledAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })} at ${appointment.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
      const staffRecipients = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "STAFF"] }, active: true, notifyNewAppointments: true },
        select: { id: true },
      });
      await notifyStaffUsers({
        userIds: staffRecipients.map((u) => u.id),
        category: "APPOINTMENT",
        tone: "WARNING",
        title: "Appointment Cancelled by Doctor",
        body: cancelSummary,
        href: `/staff/appointments/${appointment.id}`,
        relatedId: `appt-cancel-${appointment.id}`,
      });
    } else if (appointment.doctor.notifyAppointmentCancelled) {
      const cancelSummary = `${appointment.patient.name}'s appointment on ${appointment.scheduledAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })} at ${appointment.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} was cancelled by ${session.user.name ?? "staff"}.`;
      await notifyStaffUsers({
        userIds: [appointment.doctor.userId],
        category: "APPOINTMENT",
        tone: "WARNING",
        title: "Appointment Cancelled",
        body: cancelSummary,
        href: `/doctor/appointments/${appointment.id}`,
        relatedId: `appt-cancel-${appointment.id}`,
      });
      await notifyDoctor(appointment.doctorId, `❌ ${cancelSummary}`);
    }
  }

  await notifyWaitlistOfOpening(appointment.doctorId, appointment.scheduledAt);

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/doctor/appointments");
  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/consultations");
  revalidatePath("/portal/appointments");
  revalidatePath(`/portal/appointments/${appointmentId}`);
  revalidatePath("/portal");
}

export async function completeAppointment(appointmentId: string) {
  await assertCanManage(appointmentId);
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  });
  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/doctor/appointments");
  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/consultations");
}

const consultationSchema = z.object({
  bpSystolic: z.coerce.number().int().positive().optional(),
  bpDiastolic: z.coerce.number().int().positive().optional(),
  heartRateBpm: z.coerce.number().int().positive().optional(),
  temperatureC: z.coerce.number().positive().optional(),
  spo2Percent: z.coerce.number().int().min(0).max(100).optional(),
  weightKg: z.coerce.number().positive().optional(),
  heightCm: z.coerce.number().positive().optional(),
  chiefComplaint: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  physicalExam: z.string().optional(),
  clinicalNotes: z.string().optional(),
  treatmentPlan: z.string().optional(),
});

export type ConsultationFormState = { error?: string; success?: boolean };

export async function updateConsultation(
  appointmentId: string,
  _prevState: ConsultationFormState,
  formData: FormData
): Promise<ConsultationFormState> {
  const complete = formData.get("intent") === "complete";
  const session = await requireRole(["DOCTOR"]);

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your appointment");
  }

  const parsed = consultationSchema.safeParse({
    bpSystolic: formData.get("bpSystolic") || undefined,
    bpDiastolic: formData.get("bpDiastolic") || undefined,
    heartRateBpm: formData.get("heartRateBpm") || undefined,
    temperatureC: formData.get("temperatureC") || undefined,
    spo2Percent: formData.get("spo2Percent") || undefined,
    weightKg: formData.get("weightKg") || undefined,
    heightCm: formData.get("heightCm") || undefined,
    chiefComplaint: formData.get("chiefComplaint") || undefined,
    symptoms: formData.getAll("symptoms").map(String),
    physicalExam: formData.get("physicalExam") || undefined,
    clinicalNotes: formData.get("clinicalNotes") || undefined,
    treatmentPlan: formData.get("treatmentPlan") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      bpSystolic: parsed.data.bpSystolic ?? null,
      bpDiastolic: parsed.data.bpDiastolic ?? null,
      heartRateBpm: parsed.data.heartRateBpm ?? null,
      temperatureC: parsed.data.temperatureC ?? null,
      spo2Percent: parsed.data.spo2Percent ?? null,
      weightKg: parsed.data.weightKg ?? null,
      heightCm: parsed.data.heightCm ?? null,
      chiefComplaint: parsed.data.chiefComplaint ?? null,
      symptoms: parsed.data.symptoms ?? [],
      physicalExam: parsed.data.physicalExam ?? null,
      notes: parsed.data.clinicalNotes ?? null,
      treatmentPlan: parsed.data.treatmentPlan ?? null,
      ...(complete ? { status: "COMPLETED" as const } : {}),
    },
  });

  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/doctor/appointments");
  revalidatePath("/doctor/consultations");
  revalidatePath("/doctor");
  return { success: true };
}
