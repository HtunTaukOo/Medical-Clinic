"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

const diagnosisSchema = z.object({
  code: z.string().optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  severity: z.enum(["MILD", "MODERATE", "SEVERE"]).optional(),
});

export type DiagnosisFormState = { error?: string; success?: boolean };

export async function addDiagnosis(
  appointmentId: string,
  _prevState: DiagnosisFormState,
  formData: FormData
): Promise<DiagnosisFormState> {
  const session = await requireRole(["DOCTOR"]);

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your appointment");
  }

  const parsed = diagnosisSchema.safeParse({
    code: formData.get("code") || undefined,
    description: formData.get("description"),
    notes: formData.get("notes") || undefined,
    severity: formData.get("severity") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.diagnosis.create({
    data: {
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      code: parsed.data.code,
      description: parsed.data.description,
      notes: parsed.data.notes,
      severity: parsed.data.severity,
    },
  });

  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath(`/portal/appointments/${appointmentId}`);
  revalidatePath("/portal/medical-records");
  return { success: true };
}

export async function deleteDiagnosis(diagnosisId: string) {
  const session = await requireRole(["DOCTOR"]);

  const diagnosis = await prisma.diagnosis.findUniqueOrThrow({ where: { id: diagnosisId } });
  if (diagnosis.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your diagnosis");
  }

  await prisma.diagnosis.delete({ where: { id: diagnosisId } });

  revalidatePath(`/staff/appointments/${diagnosis.appointmentId}`);
  revalidatePath(`/portal/appointments/${diagnosis.appointmentId}`);
  revalidatePath("/portal/medical-records");
}

export async function setDiagnosisStatus(diagnosisId: string, status: "ACTIVE" | "RESOLVED") {
  const session = await requireRole(["DOCTOR"]);

  const diagnosis = await prisma.diagnosis.findUniqueOrThrow({ where: { id: diagnosisId } });
  if (diagnosis.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your diagnosis");
  }

  await prisma.diagnosis.update({ where: { id: diagnosisId }, data: { status } });

  revalidatePath(`/staff/appointments/${diagnosis.appointmentId}`);
  revalidatePath(`/staff/patients/${diagnosis.patientId}`);
  revalidatePath(`/portal/appointments/${diagnosis.appointmentId}`);
  revalidatePath("/portal/medical-records");
}
