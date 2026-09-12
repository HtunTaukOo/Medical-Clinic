"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";

export async function markAllNotificationsRead() {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  await prisma.notification.updateMany({
    where: { patientId, read: false },
    data: { read: true },
  });

  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
}

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  await prisma.notification.updateMany({
    where: { id, patientId },
    data: { read: true },
  });

  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
}

export async function markAllStaffNotificationsRead() {
  const session = await requireSession();

  await prisma.staffNotification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/staff/notifications");
  revalidatePath("/doctor/notifications");
}

export async function markStaffNotificationRead(id: string) {
  const session = await requireSession();

  await prisma.staffNotification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  revalidatePath("/staff/notifications");
  revalidatePath("/doctor/notifications");
}
