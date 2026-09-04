import { prisma } from "@/lib/prisma";

export const APPOINTMENT_SLOT_MINUTES = 30;

// A patient can book up to this many consecutive slots (90 min) in one
// appointment, for visits they expect to run long.
export const MAX_APPOINTMENT_SLOTS = 3;

// Finds an existing REQUESTED/CONFIRMED appointment for this doctor whose
// occupied time range overlaps [scheduledAt, scheduledAt + durationMinutes).
// Appointments can now span multiple slots (see durationMinutes on the
// Appointment model), so this compares real ranges rather than just start
// times within one slot width of each other.
export async function findConflictingAppointment(
  doctorId: string,
  scheduledAt: Date,
  durationMinutes: number = APPOINTMENT_SLOT_MINUTES
) {
  const rangeEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const maxExistingDurationMs = MAX_APPOINTMENT_SLOTS * APPOINTMENT_SLOT_MINUTES * 60 * 1000;

  const candidates = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ["REQUESTED", "CONFIRMED"] },
      scheduledAt: {
        gte: new Date(scheduledAt.getTime() - maxExistingDurationMs),
        lt: rangeEnd,
      },
    },
  });

  return (
    candidates.find((appt) => {
      const apptEnd = new Date(appt.scheduledAt.getTime() + appt.durationMinutes * 60 * 1000);
      return apptEnd > scheduledAt;
    }) ?? null
  );
}
