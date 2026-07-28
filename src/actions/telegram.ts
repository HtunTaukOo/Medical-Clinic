"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, UnauthorizedError } from "@/lib/authz";

export async function disconnectTelegram() {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  await prisma.patient.update({
    where: { id: patientId },
    data: { telegramChatId: null },
  });

  revalidatePath("/portal");
}
