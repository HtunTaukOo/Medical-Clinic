"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";
import { clinicMidnight } from "@/lib/clinic-hours";
import { blockContainingMinuteOfDay, formatBlockLabel } from "@/lib/time-blocks";
import { getBlocksForDate } from "@/lib/booking-slots";
import { notifyPatient } from "@/lib/telegram";

// Waitlist is per specialty+day+block (capacity is pooled across every
// doctor with that specialty, so a waitlist entry can't target one doctor's
// calendar) — only meaningful for BLOCK_CAPACITY specialties.
async function resolveWaitlistTarget(doctorId: string, scheduledAt: Date) {
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor?.specialty) return null;

  const specialty = await prisma.specialty.findUnique({ where: { name: doctor.specialty } });
  if (specialty?.bookingMode !== "BLOCK_CAPACITY") return null;

  const requestedDate = clinicMidnight(scheduledAt);
  const minutesOfDay = Math.round((scheduledAt.getTime() - requestedDate.getTime()) / 60000);
  const blocks = await getBlocksForDate(requestedDate);
  const block = blockContainingMinuteOfDay(blocks, minutesOfDay);
  if (!block) return null;

  return { specialtyName: specialty.name, requestedDate, block };
}

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

  const target = await resolveWaitlistTarget(parsed.data.doctorId, new Date(parsed.data.scheduledAt));
  if (!target) {
    return { error: "Waitlist isn't available for this booking." };
  }

  await prisma.waitlist.create({
    data: {
      patientId,
      specialtyName: target.specialtyName,
      requestedDate: target.requestedDate,
      blockId: target.block.id,
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
  const target = await resolveWaitlistTarget(doctorId, freedScheduledAt);
  if (!target) return;

  const candidate = await prisma.waitlist.findFirst({
    where: {
      specialtyName: target.specialtyName,
      requestedDate: target.requestedDate,
      blockId: target.block.id,
      status: "WAITING",
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return;

  await prisma.waitlist.update({
    where: { id: candidate.id },
    data: { status: "NOTIFIED", notifiedAt: new Date() },
  });

  await notifyPatient(
    candidate.patientId,
    `🎉 An opening for ${target.specialtyName} on ${target.requestedDate.toLocaleDateString()} in the ${formatBlockLabel(target.block)} block just became available — log in to the portal to book it before it's taken.`
  );

  revalidatePath("/portal/appointments");
}
