"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, UnauthorizedError } from "@/lib/authz";
import {
  findConflictingAppointment,
  APPOINTMENT_SLOT_MINUTES,
} from "@/lib/scheduling";
import {
  getClinicSettings,
  isWithinOpeningHours,
  formatTime,
  clinicWeekday,
} from "@/lib/clinic-hours";
import { isWithinSelfCheckInWindow } from "@/lib/queue";
import {
  isDoctorOnLeave,
  isWorkingDay,
  isWithinDoctorHours,
  WEEKDAY_LABELS,
} from "@/lib/doctor-availability";
import { notifyPatient, notifyStaff } from "@/lib/telegram";
import { createNotification } from "@/lib/notifications";
import { notifyWaitlistOfOpening } from "@/actions/waitlist";

const CONFLICT_MESSAGE = `This doctor already has an appointment within ${APPOINTMENT_SLOT_MINUTES} minutes of that time.`;

const bookingSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  scheduledAt: z.string().min(1),
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
  await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]);

  const parsed = bookingSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId"),
    scheduledAt: formData.get("scheduledAt"),
    reason: formData.get("reason") || undefined,
    repeatWeekly: formData.get("repeatWeekly") || undefined,
    occurrences: formData.get("occurrences") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const baseDate = new Date(parsed.data.scheduledAt);
  const isRecurring = !!parsed.data.repeatWeekly;
  const occurrenceCount = isRecurring ? Math.max(2, parsed.data.occurrences ?? 4) : 1;

  const skippedDates: string[] = [];
  let createdCount = 0;

  for (let i = 0; i < occurrenceCount; i++) {
    const occurrenceDate = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);

    const onLeave = await isDoctorOnLeave(parsed.data.doctorId, occurrenceDate);
    const conflict = onLeave ? null : await findConflictingAppointment(parsed.data.doctorId, occurrenceDate);

    if (onLeave || conflict) {
      if (!isRecurring) {
        return { error: onLeave ? "This doctor is on leave on the selected date." : CONFLICT_MESSAGE };
      }
      skippedDates.push(occurrenceDate.toLocaleDateString());
      continue;
    }

    await prisma.appointment.create({
      data: {
        patientId: parsed.data.patientId,
        doctorId: parsed.data.doctorId,
        scheduledAt: occurrenceDate,
        reason: parsed.data.reason,
        status: "CONFIRMED",
      },
    });
    createdCount++;
  }

  revalidatePath("/staff/appointments");

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
  reason?: string
): Promise<AppointmentFormState> {
  const settings = await getClinicSettings();
  if (!settings.isOpen) {
    return { error: "The clinic is currently closed for bookings. Please check back later." };
  }
  if (!isWithinOpeningHours(scheduledAt, settings.openingTime, settings.closingTime)) {
    return {
      error: `Please choose a time between ${formatTime(settings.openingTime)} and ${formatTime(settings.closingTime)}.`,
    };
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
  });
  if (!doctor) {
    return { error: "Doctor not found" };
  }

  const onLeave = await isDoctorOnLeave(doctor.id, scheduledAt);
  if (onLeave) {
    return { error: "This doctor is unavailable on the selected date. Please choose another day." };
  }
  if (!isWorkingDay(doctor.workingDays, scheduledAt)) {
    return {
      error: `This doctor doesn't see patients on ${WEEKDAY_LABELS[clinicWeekday(scheduledAt)]}s. Please choose another day.`,
    };
  }
  if (!isWithinDoctorHours(scheduledAt, doctor.workStartTime, doctor.workEndTime)) {
    return {
      error: `Please choose a time between ${formatTime(doctor.workStartTime!)} and ${formatTime(doctor.workEndTime!)} for this doctor.`,
    };
  }

  const conflict = await findConflictingAppointment(doctorId, scheduledAt);
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

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      scheduledAt,
      reason,
      status: "REQUESTED",
    },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  await notifyStaff(
    `📅 New appointment request: ${appointment.patient.name} with ${appointment.doctor.user.name} at ${scheduledAt.toLocaleString()}.`
  );

  revalidatePath("/portal/appointments");
  return { success: true };
}

async function assertCanManage(appointmentId: string) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]);
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
  revalidatePath("/portal/notifications");
}

export async function checkInAppointment(appointmentId: string) {
  const session = await requireSession();
  const role = session.user.role;

  if (role === "ADMIN" || role === "RECEPTIONIST") {
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
    if (!isWithinSelfCheckInWindow(appointment.scheduledAt)) {
      throw new UnauthorizedError("Outside the self check-in window");
    }
  } else {
    throw new UnauthorizedError("Not allowed to check in appointments");
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
  });
  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
  revalidatePath("/portal/appointments");
  revalidatePath("/portal");
}

export async function markNoShow(appointmentId: string) {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
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
}

export async function cancelAppointment(appointmentId: string) {
  const session = await requireSession();
  const role = session.user.role;
  let cancelledByPatient = false;

  if (role === "ADMIN" || role === "RECEPTIONIST") {
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
  } else {
    await notifyPatient(
      appointment.patientId,
      `❌ Your appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} has been cancelled.`
    );
  }

  await notifyWaitlistOfOpening(appointment.doctorId, appointment.scheduledAt);

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
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
}

const vitalsSchema = z.object({
  bpSystolic: z.coerce.number().int().positive().optional(),
  bpDiastolic: z.coerce.number().int().positive().optional(),
  heartRateBpm: z.coerce.number().int().positive().optional(),
  temperatureC: z.coerce.number().positive().optional(),
  respiratoryRate: z.coerce.number().int().positive().optional(),
  spo2Percent: z.coerce.number().int().min(0).max(100).optional(),
});

export type VitalsFormState = { error?: string; success?: boolean };

export async function updateVitals(
  appointmentId: string,
  _prevState: VitalsFormState,
  formData: FormData
): Promise<VitalsFormState> {
  const session = await requireRole(["DOCTOR"]);

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your appointment");
  }

  const parsed = vitalsSchema.safeParse({
    bpSystolic: formData.get("bpSystolic") || undefined,
    bpDiastolic: formData.get("bpDiastolic") || undefined,
    heartRateBpm: formData.get("heartRateBpm") || undefined,
    temperatureC: formData.get("temperatureC") || undefined,
    respiratoryRate: formData.get("respiratoryRate") || undefined,
    spo2Percent: formData.get("spo2Percent") || undefined,
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
      respiratoryRate: parsed.data.respiratoryRate ?? null,
      spo2Percent: parsed.data.spo2Percent ?? null,
    },
  });

  revalidatePath(`/staff/appointments/${appointmentId}`);
  return { success: true };
}
