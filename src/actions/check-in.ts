"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { redirect } from "@/i18n/navigation";
import { generatePatientCode } from "@/lib/patients";
import { logActivity } from "@/lib/audit";

const registerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  doctorId: z.string().min(1),
  reason: z.string().optional(),
});

export type RegisterAndCheckInState = { error?: string };

export async function registerAndCheckIn(
  _prevState: RegisterAndCheckInState,
  formData: FormData
): Promise<RegisterAndCheckInState> {
  const session = await requireRole(STAFF_ROLES);

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    gender: formData.get("gender") || undefined,
    doctorId: formData.get("doctorId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, phone, dob, gender, doctorId, reason } = parsed.data;
  const now = new Date();

  const { appointment } = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        name,
        phone,
        gender,
        dob: dob ? new Date(dob) : undefined,
        patientCode: await generatePatientCode(tx),
      },
    });

    const appointment = await tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId,
        scheduledAt: now,
        status: "CHECKED_IN",
        checkedInAt: now,
        reason,
      },
    });

    return { appointment };
  });

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
