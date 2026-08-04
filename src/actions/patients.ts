"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, UnauthorizedError } from "@/lib/authz";

const PATIENT_STAFF_ROLES = ["ADMIN", "DOCTOR", "RECEPTIONIST"] as const;
const PATIENT_EDIT_ROLES = ["ADMIN", "RECEPTIONIST"] as const;

const patientSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  allergies: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

export type PatientFormState = { error?: string; success?: boolean };

// The gender <Select> uses an "UNSPECIFIED" sentinel item since Radix Select
// items can't have an empty string value; treat it the same as "not set".
function readGender(formData: FormData) {
  const raw = formData.get("gender");
  return raw && raw !== "UNSPECIFIED" ? raw : undefined;
}

function parsePatientForm(formData: FormData) {
  return patientSchema.safeParse({
    name: formData.get("name"),
    gender: readGender(formData),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
    allergies: formData.get("allergies") || undefined,
    insuranceProvider: formData.get("insuranceProvider") || undefined,
    insurancePolicyNumber: formData.get("insurancePolicyNumber") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
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

  const {
    name,
    gender,
    email,
    phone,
    dob,
    address,
    notes,
    allergies,
    insuranceProvider,
    insurancePolicyNumber,
    emergencyContactName,
    emergencyContactPhone,
  } = parsed.data;

  await prisma.patient.create({
    data: {
      name,
      gender,
      email: email || undefined,
      phone,
      address,
      notes,
      allergies,
      insuranceProvider,
      insurancePolicyNumber,
      emergencyContactName,
      emergencyContactPhone,
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
  await requireRole([...PATIENT_EDIT_ROLES]);

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const {
    name,
    gender,
    email,
    phone,
    dob,
    address,
    notes,
    allergies,
    insuranceProvider,
    insurancePolicyNumber,
    emergencyContactName,
    emergencyContactPhone,
  } = parsed.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      name,
      gender: gender ?? null,
      email: email || null,
      phone,
      address,
      notes,
      allergies: allergies || null,
      insuranceProvider: insuranceProvider || null,
      insurancePolicyNumber: insurancePolicyNumber || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      dob: dob ? new Date(dob) : null,
    },
  });

  revalidatePath("/staff/patients");
  revalidatePath(`/staff/patients/${patientId}`);
  return { success: true };
}

const selfProfileSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  allergies: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

export async function updateOwnProfile(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const parsed = selfProfileSchema.safeParse({
    name: formData.get("name"),
    gender: readGender(formData),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    address: formData.get("address") || undefined,
    allergies: formData.get("allergies") || undefined,
    insuranceProvider: formData.get("insuranceProvider") || undefined,
    insurancePolicyNumber: formData.get("insurancePolicyNumber") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const {
    name,
    gender,
    email,
    phone,
    dob,
    address,
    allergies,
    insuranceProvider,
    insurancePolicyNumber,
    emergencyContactName,
    emergencyContactPhone,
  } = parsed.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      name,
      gender: gender ?? null,
      email: email || null,
      phone,
      address,
      allergies: allergies || null,
      insuranceProvider: insuranceProvider || null,
      insurancePolicyNumber: insurancePolicyNumber || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      dob: dob ? new Date(dob) : null,
    },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}
