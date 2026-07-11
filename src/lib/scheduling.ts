import { prisma } from "@/lib/prisma";

export const APPOINTMENT_SLOT_MINUTES = 30;

export async function findConflictingAppointment(
  doctorId: string,
  scheduledAt: Date
) {
  const slotMs = APPOINTMENT_SLOT_MINUTES * 60 * 1000;

  return prisma.appointment.findFirst({
    where: {
      doctorId,
      status: { in: ["REQUESTED", "CONFIRMED"] },
      scheduledAt: {
        gt: new Date(scheduledAt.getTime() - slotMs),
        lt: new Date(scheduledAt.getTime() + slotMs),
      },
    },
  });
}
