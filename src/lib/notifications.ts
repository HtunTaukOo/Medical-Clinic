import { Prisma, type NotificationCategory, type NotificationTone } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Idempotent: `relatedId` is unique per patient, so calling this more than
// once for the same real-world event (e.g. a cron re-run) is a no-op.
export async function createNotification(input: {
  patientId: string;
  category: NotificationCategory;
  tone?: NotificationTone;
  title: string;
  body: string;
  href?: string;
  relatedId: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        patientId: input.patientId,
        category: input.category,
        tone: input.tone ?? "INFO",
        title: input.title,
        body: input.body,
        href: input.href,
        relatedId: input.relatedId,
      },
    });
  } catch (err) {
    // Unique constraint on [patientId, relatedId] — this event was already recorded.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

export async function notifyAllPatients(input: {
  category: NotificationCategory;
  tone?: NotificationTone;
  title: string;
  body: string;
  href?: string;
  relatedId: string;
}) {
  const patients = await prisma.patient.findMany({
    where: { userId: { not: null } },
    select: { id: true },
  });
  if (patients.length === 0) return;

  await prisma.notification.createMany({
    data: patients.map((p) => ({
      patientId: p.id,
      category: input.category,
      tone: input.tone ?? "INFO",
      title: input.title,
      body: input.body,
      href: input.href,
      relatedId: input.relatedId,
    })),
    skipDuplicates: true,
  });
}

export async function getUnreadNotificationCount(patientId: string) {
  return prisma.notification.count({ where: { patientId, read: false } });
}

const RENEWAL_WINDOW_DAYS = 7;

// Not event-driven like the others — computed from live prescription data each
// time the notifications page loads, then upserted so it persists/reads like
// the rest of the feed instead of needing its own cron job.
export async function ensurePrescriptionRenewalNotifications(patientId: string) {
  const now = Date.now();
  const items = await prisma.prescriptionItem.findMany({
    where: {
      prescription: { patientId },
      durationDays: { not: null },
    },
    include: { medicine: true, prescription: { include: { doctor: { include: { user: true } } } } },
  });

  for (const item of items) {
    if (!item.durationDays) continue;
    const start = item.prescription.fulfilledAt ?? item.prescription.createdAt;
    const end = start.getTime() + item.durationDays * 86400000;
    const daysLeft = Math.ceil((end - now) / 86400000);
    if (daysLeft < 0 || daysLeft > RENEWAL_WINDOW_DAYS) continue;

    await createNotification({
      patientId,
      category: "PRESCRIPTION",
      tone: "WARNING",
      title: "Prescription Renewal Due",
      body: `Your prescription for ${item.medicine.name} ${item.dosage} (${item.prescription.doctor.user.name}) is due for renewal in ${Math.max(daysLeft, 0)} day${daysLeft === 1 ? "" : "s"}. Book a follow-up to reorder.`,
      href: "/portal/medical-records",
      relatedId: `rx-renewal-${item.id}`,
    });
  }
}
