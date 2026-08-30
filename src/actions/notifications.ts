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
