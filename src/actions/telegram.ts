"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";

export async function disconnectTelegram() {
  const session = await requireSession();

  if (session.user.patientId) {
    await prisma.patient.update({
      where: { id: session.user.patientId },
      data: { telegramChatId: null },
    });
    revalidatePath("/portal");
    return;
  }

  if (session.user.doctorId) {
    await prisma.doctorProfile.update({
      where: { id: session.user.doctorId },
      data: { telegramChatId: null },
    });
    revalidatePath("/doctor/profile");
    return;
  }

  throw new UnauthorizedError("No linked profile");
}
