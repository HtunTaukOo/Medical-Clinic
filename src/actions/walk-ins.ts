"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { redirect } from "@/i18n/navigation";
import { getNextTokenNumber } from "@/lib/walk-ins";
import { logActivity } from "@/lib/audit";
import { generatePatientCode } from "@/lib/patients";

const QUEUE_STAFF_ROLES = ["ADMIN", "RECEPTIONIST"] as const;

const registerSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  reason: z.string().optional(),
  doctorId: z.string().optional(),
});

export type RegisterWalkInState = { error?: string; success?: boolean; tokenNumber?: number };

export async function registerWalkIn(
  _prevState: RegisterWalkInState,
  formData: FormData
): Promise<RegisterWalkInState> {
  const session = await requireRole([...QUEUE_STAFF_ROLES]);

  const parsed = registerSchema.safeParse({
    name: formData.get("name") || undefined,
    phone: formData.get("phone") || undefined,
    reason: formData.get("reason") || undefined,
    doctorId: formData.get("doctorId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tokenNumber = await getNextTokenNumber();

  const walkIn = await prisma.walkIn.create({
    data: { tokenNumber, ...parsed.data },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Registered walk-in, token #${tokenNumber}`,
    target: `Walk-in ${walkIn.id}`,
  });

  revalidatePath("/staff/queue");
  return { success: true, tokenNumber };
}

export async function callWalkIn(walkInId: string) {
  await requireRole([...QUEUE_STAFF_ROLES]);

  const walkIn = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkInId } });
  if (walkIn.status !== "WAITING") {
    throw new Error("Only a waiting walk-in can be called");
  }

  await prisma.walkIn.update({
    where: { id: walkInId },
    data: { status: "CALLED", calledAt: new Date() },
  });

  revalidatePath("/staff/queue");
}

export async function cancelWalkIn(walkInId: string) {
  await requireRole([...QUEUE_STAFF_ROLES]);

  const walkIn = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkInId } });
  if (walkIn.status === "COMPLETED" || walkIn.status === "CANCELLED") {
    throw new Error("This walk-in can no longer be cancelled");
  }

  await prisma.walkIn.update({
    where: { id: walkInId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/staff/queue");
}

const convertSchema = z.object({
  patientId: z.string().optional(),
  newPatientName: z.string().optional(),
  doctorId: z.string().min(1),
});

export type ConvertWalkInState = { error?: string };

export async function convertWalkInToAppointment(
  walkInId: string,
  _prevState: ConvertWalkInState,
  formData: FormData
): Promise<ConvertWalkInState> {
  const session = await requireRole([...QUEUE_STAFF_ROLES]);

  const walkIn = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkInId } });
  if (walkIn.status !== "CALLED") {
    return { error: "Only a called walk-in can be converted to an appointment" };
  }

  const parsed = convertSchema.safeParse({
    patientId: formData.get("patientId") || undefined,
    newPatientName: formData.get("newPatientName") || undefined,
    doctorId: formData.get("doctorId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!parsed.data.patientId && !parsed.data.newPatientName) {
    return { error: "Select an existing patient or enter a name for a new one" };
  }

  const now = new Date();

  const { appointment } = await prisma.$transaction(async (tx) => {
    const patientId = parsed.data.patientId
      ? parsed.data.patientId
      : (
          await tx.patient.create({
            data: {
              name: parsed.data.newPatientName!,
              phone: walkIn.phone ?? undefined,
              patientCode: await generatePatientCode(tx),
            },
          })
        ).id;

    const appointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId: parsed.data.doctorId,
        scheduledAt: now,
        status: "CHECKED_IN",
        checkedInAt: now,
        reason: walkIn.reason ?? undefined,
      },
    });

    await tx.walkIn.update({
      where: { id: walkInId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        patientId,
        appointmentId: appointment.id,
      },
    });

    return { appointment };
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Converted walk-in token #${walkIn.tokenNumber} to an appointment`,
    target: `Appointment ${appointment.id}`,
  });

  revalidatePath("/staff/queue");
  revalidatePath("/staff/appointments");

  // A server-side redirect (not a client useEffect + router.push) matters here:
  // submitting this form changes the walk-in's status away from CALLED, which
  // is this very page's own render guard. Next.js revalidates the current
  // page as part of the action response, so a client-side redirect would race
  // that revalidation and could show a 404 for the now-invalid page before it
  // ever navigates away.
  const locale = await getLocale();
  return redirect({ href: `/staff/appointments/${appointment.id}`, locale });
}
