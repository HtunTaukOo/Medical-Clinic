"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";
import { APPOINTMENT_SLOT_MINUTES } from "@/lib/scheduling";
import { notifyPatient } from "@/lib/telegram";

const joinSchema = z.object({
  doctorId: z.string().min(1),
  scheduledAt: z.string().min(1),
  reason: z.string().optional(),
});

export type WaitlistFormState = { error?: string; success?: boolean };

export async function joinWaitlist(
  _prevState: WaitlistFormState,
  formData: FormData
): Promise<WaitlistFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const parsed = joinSchema.safeParse({
    doctorId: formData.get("doctorId"),
    scheduledAt: formData.get("scheduledAt"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.waitlist.create({
    data: {
      patientId,
      doctorId: parsed.data.doctorId,
      requestedAt: new Date(parsed.data.scheduledAt),
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/portal/appointments");
  return { success: true };
}

export async function leaveWaitlist(waitlistId: string) {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const entry = await prisma.waitlist.findUniqueOrThrow({ where: { id: waitlistId } });
  if (entry.patientId !== patientId) {
    throw new UnauthorizedError("Not your waitlist entry");
  }

  await prisma.waitlist.delete({ where: { id: waitlistId } });
  revalidatePath("/portal/appointments");
}

export async function notifyWaitlistOfOpening(doctorId: string, freedScheduledAt: Date) {
  const slotMs = APPOINTMENT_SLOT_MINUTES * 60 * 1000;

  const candidate = await prisma.waitlist.findFirst({
    where: {
      doctorId,
      status: "WAITING",
      requestedAt: {
        gt: new Date(freedScheduledAt.getTime() - slotMs),
        lt: new Date(freedScheduledAt.getTime() + slotMs),
      },
    },
    orderBy: { createdAt: "asc" },
    include: { doctor: { include: { user: true } } },
  });
  if (!candidate) return;

  await prisma.waitlist.update({
    where: { id: candidate.id },
    data: { status: "NOTIFIED", notifiedAt: new Date() },
  });

  await notifyPatient(
    candidate.patientId,
    `🎉 An opening with ${candidate.doctor.user.name} around ${freedScheduledAt.toLocaleString()} just became available — log in to the portal to book it before it's taken.`
  );

  revalidatePath("/portal/appointments");
}
