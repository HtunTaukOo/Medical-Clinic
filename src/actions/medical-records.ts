"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, UnauthorizedError } from "@/lib/authz";
import { MAX_FILE_SIZE_BYTES } from "@/lib/medical-records";

export type MedicalRecordFormState = { error?: string; success?: boolean };

const noteSchema = z.object({
  note: z.string().min(1),
});

export async function addMedicalNote(
  patientId: string,
  _prevState: MedicalRecordFormState,
  formData: FormData
): Promise<MedicalRecordFormState> {
  const session = await requireRole(["DOCTOR"]);

  const parsed = noteSchema.safeParse({ note: formData.get("note") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.medicalRecord.create({
    data: {
      patientId,
      authorId: session.user.id,
      type: "NOTE",
      note: parsed.data.note,
    },
  });

  revalidatePath(`/staff/patients/${patientId}`);
  return { success: true };
}

export async function uploadMedicalDocument(
  patientId: string,
  _prevState: MedicalRecordFormState,
  formData: FormData
): Promise<MedicalRecordFormState> {
  const session = await requireSession();
  const role = session.user.role;

  let targetPatientId: string;
  if (role === "PATIENT") {
    if (!session.user.patientId) throw new UnauthorizedError("No patient profile");
    targetPatientId = session.user.patientId;
  } else if (role === "ADMIN" || role === "RECEPTIONIST") {
    targetPatientId = patientId;
  } else {
    throw new UnauthorizedError("Not allowed to upload documents");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "File is too large (max 10MB)" };
  }

  const noteValue = formData.get("note");
  const buffer = Buffer.from(await file.arrayBuffer());

  await prisma.medicalRecord.create({
    data: {
      patientId: targetPatientId,
      authorId: session.user.id,
      type: "DOCUMENT",
      note: typeof noteValue === "string" && noteValue ? noteValue : null,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileData: buffer,
    },
  });

  revalidatePath(`/staff/patients/${targetPatientId}`);
  revalidatePath("/portal/records");
  return { success: true };
}
