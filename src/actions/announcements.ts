"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/announcements";
import { notifyAllPatients, notifyStaffUsers } from "@/lib/notifications";
import { notifyDoctor } from "@/lib/telegram";

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
  const session = await requireRole(["ADMIN", "STAFF"]);

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

  const [staffRecipients, doctorRecipients] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "STAFF"] },
        active: true,
        notifyAnnouncements: true,
        id: { not: session.user.id },
      },
      select: { id: true },
    }),
    prisma.doctorProfile.findMany({
      where: { notifyAnnouncements: true },
      select: { id: true, userId: true },
    }),
  ]);
  await notifyStaffUsers({
    userIds: staffRecipients.map((u) => u.id),
    category: "ANNOUNCEMENT",
    tone: "INFO",
    title: parsed.data.title,
    body: parsed.data.body,
    href: "/staff/announcements",
    relatedId: `announcement-${announcement.id}`,
  });
  await notifyStaffUsers({
    userIds: doctorRecipients.map((d) => d.userId),
    category: "ANNOUNCEMENT",
    tone: "INFO",
    title: parsed.data.title,
    body: parsed.data.body,
    relatedId: `announcement-${announcement.id}`,
  });
  await Promise.all(
    doctorRecipients.map((d) => notifyDoctor(d.id, `📣 <b>${parsed.data.title}</b>\n\n${parsed.data.body}`))
  );

  revalidatePath("/staff/announcements");
  revalidatePath("/portal");
  revalidatePath("/portal/notifications");
  return { success: true };
}

export async function toggleAnnouncementActive(announcementId: string) {
  await requireRole(["ADMIN", "STAFF"]);

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
