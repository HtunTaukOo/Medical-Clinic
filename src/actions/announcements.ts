"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/announcements";
import { notifyAllPatients } from "@/lib/notifications";

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default("General"),
});

export type AnnouncementFormState = { error?: string; success?: boolean };

export async function createAnnouncement(
  _prevState: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]);

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    category: formData.get("category") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const announcement = await prisma.announcement.create({
    data: { ...parsed.data, authorId: session.user.id },
  });

  await notifyAllPatients({
    category: "ANNOUNCEMENT",
    tone: "INFO",
    title: parsed.data.title,
    body: parsed.data.body,
    href: "/portal",
    relatedId: `announcement-${announcement.id}`,
  });

  revalidatePath("/staff/announcements");
  revalidatePath("/portal");
  revalidatePath("/portal/notifications");
  return { success: true };
}

export async function toggleAnnouncementActive(announcementId: string) {
  await requireRole(["ADMIN", "RECEPTIONIST"]);

  const announcement = await prisma.announcement.findUniqueOrThrow({
    where: { id: announcementId },
  });
  await prisma.announcement.update({
    where: { id: announcementId },
    data: { active: !announcement.active },
  });

  revalidatePath("/staff/announcements");
  revalidatePath("/portal");
}
