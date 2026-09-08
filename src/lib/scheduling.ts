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
  durationMinutes: number = APPOINTMENT_SLOT_MINUTES,
  excludeAppointmentId?: string
) {
  const rangeEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const maxExistingDurationMs = MAX_APPOINTMENT_SLOTS * APPOINTMENT_SLOT_MINUTES * 60 * 1000;

  const candidates = await prisma.appointment.findMany({
    where: {
      doctorId,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
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

// The "book by service" counterpart to findConflictingAppointment — instead
// of one doctor being exclusively booked or free, a specialty like Laboratory
// can absorb multiple simultaneous visits (e.g. several stations) up to
// capacityPerSlot. Counts every REQUESTED/CONFIRMED appointment across every
// doctor tagged with this specialty whose range overlaps the requested one.
export async function isResourceSlotAvailable(
  resource: { specialtyName: string; capacityPerSlot: number },
  scheduledAt: Date,
  durationMinutes: number = APPOINTMENT_SLOT_MINUTES,
  excludeAppointmentId?: string
): Promise<boolean> {
  const rangeEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const maxExistingDurationMs = MAX_APPOINTMENT_SLOTS * APPOINTMENT_SLOT_MINUTES * 60 * 1000;

  const candidates = await prisma.appointment.findMany({
    where: {
      doctor: { specialty: resource.specialtyName },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      status: { in: ["REQUESTED", "CONFIRMED"] },
      scheduledAt: { gte: new Date(scheduledAt.getTime() - maxExistingDurationMs), lt: rangeEnd },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const occupied = candidates.filter((appt) => {
    const apptEnd = new Date(appt.scheduledAt.getTime() + appt.durationMinutes * 60 * 1000);
    return apptEnd > scheduledAt;
  }).length;

  return occupied < resource.capacityPerSlot;
}
