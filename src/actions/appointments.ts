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
} from "@/lib/clinic-hours";
import { isWithinSelfCheckInWindow } from "@/lib/queue";

const CONFLICT_MESSAGE = `This doctor already has an appointment within ${APPOINTMENT_SLOT_MINUTES} minutes of that time.`;

const bookingSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  scheduledAt: z.string().min(1),
  reason: z.string().optional(),
});

export type AppointmentFormState = { error?: string; success?: boolean };

export async function createAppointment(
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  await requireRole(["ADMIN", "RECEPTIONIST"]);

  const parsed = bookingSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId"),
    scheduledAt: formData.get("scheduledAt"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  const conflict = await findConflictingAppointment(parsed.data.doctorId, scheduledAt);
  if (conflict) {
    return { error: CONFLICT_MESSAGE };
  }

  await prisma.appointment.create({
    data: {
      patientId: parsed.data.patientId,
      doctorId: parsed.data.doctorId,
      scheduledAt,
      reason: parsed.data.reason,
      status: "CONFIRMED",
    },
  });

  revalidatePath("/staff/appointments");
  return { success: true };
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

  const scheduledAt = new Date(parsed.data.scheduledAt);

  const settings = await getClinicSettings();
  if (!settings.isOpen) {
    return { error: "The clinic is currently closed for bookings. Please check back later." };
  }
  if (!isWithinOpeningHours(scheduledAt, settings.openingTime, settings.closingTime)) {
    return {
      error: `Please choose a time between ${formatTime(settings.openingTime)} and ${formatTime(settings.closingTime)}.`,
    };
  }

  const conflict = await findConflictingAppointment(parsed.data.doctorId, scheduledAt);
  if (conflict) {
    return { error: CONFLICT_MESSAGE };
  }

  await prisma.appointment.create({
    data: {
      patientId,
      doctorId: parsed.data.doctorId,
      scheduledAt,
      reason: parsed.data.reason,
      status: "REQUESTED",
    },
  });

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
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED" },
  });
  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
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

export async function cancelAppointment(appointmentId: string) {
  await assertCanManage(appointmentId);
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/queue");
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
