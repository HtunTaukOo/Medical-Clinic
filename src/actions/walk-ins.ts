"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { redirect } from "@/i18n/navigation";
import { logActivity } from "@/lib/audit";
import { generatePatientCode } from "@/lib/patients";
import { createLabOrderForLinkedService } from "@/actions/appointments";
import { getClinicHoursForDate, clinicLocalMinutes, clinicMidnight, toMinutes } from "@/lib/clinic-hours";
import { blockContainingMinuteOfDay, nearestBlock, blockDurationMinutes } from "@/lib/time-blocks";
import { isBlockSlotAvailable } from "@/lib/scheduling";

export async function callWalkIn(walkInId: string) {
  await requireRole(STAFF_ROLES);

  const walkIn = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkInId } });
  if (walkIn.status !== "WAITING") {
    throw new Error("Only a waiting walk-in can be called");
  }

  await prisma.walkIn.update({
    where: { id: walkInId },
    data: { status: "CALLED", calledAt: new Date() },
  });

  revalidatePath("/staff/queue");
  revalidatePath("/staff");
}

export async function cancelWalkIn(walkInId: string) {
  await requireRole(STAFF_ROLES);

  const walkIn = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkInId } });
  if (walkIn.status === "COMPLETED" || walkIn.status === "CANCELLED") {
    throw new Error("This walk-in can no longer be cancelled");
  }

  await prisma.walkIn.update({
    where: { id: walkInId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/staff/queue");
}

const convertSchema = z.object({
  patientId: z.string().optional(),
  newPatientName: z.string().optional(),
  // Either doctorId (a real doctor) or specialtyName (a SERVICE_CAPACITY
  // specialty like Lab Visit — the doctor is auto-assigned server-side).
  doctorId: z.string().optional(),
  specialtyName: z.string().optional(),
  clinicServiceId: z.string().optional(),
});

export type ConvertWalkInState = { error?: string };

export async function convertWalkInToAppointment(
  walkInId: string,
  _prevState: ConvertWalkInState,
  formData: FormData
): Promise<ConvertWalkInState> {
  const session = await requireRole(STAFF_ROLES);

  const walkIn = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkInId } });
  if (walkIn.status !== "CALLED") {
    return { error: "Only a called walk-in can be converted to an appointment" };
  }

  const parsed = convertSchema.safeParse({
    patientId: formData.get("patientId") || undefined,
    newPatientName: formData.get("newPatientName") || undefined,
    doctorId: formData.get("doctorId") || undefined,
    specialtyName: formData.get("specialtyName") || undefined,
    clinicServiceId: formData.get("clinicServiceId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!parsed.data.patientId && !parsed.data.newPatientName) {
    return { error: "Select an existing patient or enter a name for a new one" };
  }

  let doctorId: string;
  let specialty: Awaited<ReturnType<typeof prisma.specialty.findUnique>> = null;

  if (parsed.data.specialtyName) {
    specialty = await prisma.specialty.findUnique({ where: { name: parsed.data.specialtyName } });
    if (!specialty || specialty.bookingMode !== "SERVICE_CAPACITY") {
      return { error: "This specialty isn't set up for service-based visits." };
    }
    if (!parsed.data.clinicServiceId) {
      return { error: "Select which service or lab test this visit is for" };
    }
    const assignedDoctor = await prisma.doctorProfile.findFirst({
      where: { specialty: specialty.name },
      orderBy: { id: "asc" },
    });
    if (!assignedDoctor) {
      return { error: "No staff are set up for this specialty yet. Please contact the clinic." };
    }
    doctorId = assignedDoctor.id;
  } else {
    if (!parsed.data.doctorId) return { error: "Please choose a doctor." };
    doctorId = parsed.data.doctorId;
    const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctorId } });
    specialty = doctor.specialty
      ? await prisma.specialty.findUnique({ where: { name: doctor.specialty } })
      : null;
  }

  const clinicService = parsed.data.clinicServiceId
    ? await prisma.clinicService.findUnique({ where: { id: parsed.data.clinicServiceId } })
    : null;

  const now = new Date();

  let scheduledAt = now;
  let durationMinutes: number | undefined = clinicService?.durationMinutes;
  if (specialty?.bookingMode === "BLOCK_CAPACITY" || specialty?.bookingMode === "SERVICE_CAPACITY") {
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
        error: `This time block is at capacity (${specialty.capacityPerSlot} patients). Please try again shortly.`,
      };
    }
  }

  const { appointment } = await prisma.$transaction(async (tx) => {
    const patientId = parsed.data.patientId
      ? parsed.data.patientId
      : (
          await tx.patient.create({
            data: {
              name: parsed.data.newPatientName!,
              phone: walkIn.phone ?? undefined,
              patientCode: await generatePatientCode(tx),
            },
          })
        ).id;

    const appointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId,
        clinicServiceId: clinicService?.id,
        scheduledAt,
        durationMinutes,
        status: "CHECKED_IN",
        checkedInAt: now,
        reason: walkIn.reason ?? clinicService?.name,
      },
      include: { clinicService: true },
    });

    await tx.walkIn.update({
      where: { id: walkInId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        patientId,
        appointmentId: appointment.id,
      },
    });

    return { appointment };
  });

  await createLabOrderForLinkedService(appointment);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Converted walk-in token #${walkIn.tokenNumber} to an appointment`,
    target: `Appointment ${appointment.id}`,
  });

  revalidatePath("/staff/queue");
  revalidatePath("/staff/appointments");

  // A server-side redirect (not a client useEffect + router.push) matters here:
  // submitting this form changes the walk-in's status away from CALLED, which
  // is this very page's own render guard. Next.js revalidates the current
  // page as part of the action response, so a client-side redirect would race
  // that revalidation and could show a 404 for the now-invalid page before it
  // ever navigates away.
  const locale = await getLocale();
  return redirect({ href: `/staff/appointments/${appointment.id}`, locale });
}
