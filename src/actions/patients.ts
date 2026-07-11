"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const PATIENT_STAFF_ROLES = ["ADMIN", "DOCTOR", "RECEPTIONIST"] as const;

const patientSchema = z.object({
  name: z.string().min(1),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type PatientFormState = { error?: string; success?: boolean };

function parsePatientForm(formData: FormData) {
  return patientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createPatient(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  await requireRole([...PATIENT_STAFF_ROLES]);

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, phone, dob, address, notes } = parsed.data;

  await prisma.patient.create({
    data: {
      name,
      email: email || undefined,
      phone,
      address,
      notes,
      dob: dob ? new Date(dob) : undefined,
    },
  });

  revalidatePath("/staff/patients");
  return { success: true };
}

export async function updatePatient(
  patientId: string,
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  await requireRole([...PATIENT_STAFF_ROLES]);

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, phone, dob, address, notes } = parsed.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      name,
      email: email || null,
      phone,
      address,
      notes,
      dob: dob ? new Date(dob) : null,
    },
  });

  revalidatePath("/staff/patients");
  revalidatePath(`/staff/patients/${patientId}`);
  return { success: true };
}
