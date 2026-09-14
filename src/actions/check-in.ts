"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { redirect } from "@/i18n/navigation";
import { generatePatientCode } from "@/lib/patients";
import { logActivity } from "@/lib/audit";
import { createLabOrderForLinkedService } from "@/actions/appointments";
import { getClinicHoursForDate, clinicLocalMinutes, clinicMidnight, toMinutes } from "@/lib/clinic-hours";
import { blockContainingMinuteOfDay, nearestBlock, blockDurationMinutes } from "@/lib/time-blocks";
import { isBlockSlotAvailable } from "@/lib/scheduling";

const registerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  doctorId: z.string().min(1),
  clinicServiceId: z.string().optional(),
  reason: z.string().optional(),
});

export type RegisterAndCheckInState = { error?: string };

export async function registerAndCheckIn(
  _prevState: RegisterAndCheckInState,
  formData: FormData
): Promise<RegisterAndCheckInState> {
  const session = await requireRole(STAFF_ROLES);

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    gender: formData.get("gender") || undefined,
    doctorId: formData.get("doctorId"),
    clinicServiceId: formData.get("clinicServiceId") || undefined,
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, phone, dob, gender, doctorId, clinicServiceId, reason } = parsed.data;

  const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctorId } });
  const specialty = doctor.specialty
    ? await prisma.specialty.findUnique({ where: { name: doctor.specialty } })
    : null;
  if (specialty?.bookingMode === "SERVICE_CAPACITY" && !clinicServiceId) {
    return { error: "Select which service or lab test this visit is for" };
  }
  const clinicService = clinicServiceId
    ? await prisma.clinicService.findUnique({ where: { id: clinicServiceId } })
    : null;

  const now = new Date();

  // A block-mode walk-in is always "right now" — resolve whichever of the 5
  // fixed blocks contains the current clinic-local time (clamped to the
  // nearest one if outside all of them, e.g. before the clinic's first
  // block), then capacity-check it the same way the booking wizard does.
  let scheduledAt = now;
  let durationMinutes: number | undefined = clinicService?.durationMinutes;
  if (specialty?.bookingMode === "BLOCK_CAPACITY") {
    const clinicHours = await getClinicHoursForDate(now);
    if (!clinicHours.isOpen) {
      return { error: "The clinic is closed today." };
    }
    const minutesNow = clinicLocalMinutes(now);
    const block = blockContainingMinuteOfDay(minutesNow) ?? nearestBlock(minutesNow);
    const dayStart = clinicMidnight(now);
    scheduledAt = new Date(dayStart.getTime() + toMinutes(block.startTime) * 60 * 1000);
    durationMinutes = blockDurationMinutes(block);

    const { available } = await isBlockSlotAvailable(specialty.name, specialty.capacityPerSlot, scheduledAt);
    if (!available) {
      return {
        error: `This time block is at capacity (${specialty.capacityPerSlot} patients). Please try a different doctor.`,
      };
    }
  }

  const { appointment } = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        name,
        phone,
        gender,
        dob: dob ? new Date(dob) : undefined,
        patientCode: await generatePatientCode(tx),
      },
    });

    const appointment = await tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId,
        clinicServiceId: clinicService?.id,
        scheduledAt,
        durationMinutes,
        status: "CHECKED_IN",
        checkedInAt: now,
        reason: reason ?? clinicService?.name,
      },
      include: { clinicService: true },
    });

    return { appointment };
  });

  await createLabOrderForLinkedService(appointment);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Registered and checked in a walk-in patient",
    target: `Appointment ${appointment.id}`,
  });

  revalidatePath("/staff/queue");
  revalidatePath("/staff/appointments");
  revalidatePath("/staff/patients");
  revalidatePath("/staff");

  const locale = await getLocale();
  return redirect({ href: `/staff/appointments/${appointment.id}`, locale });
}
