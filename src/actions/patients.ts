"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, UnauthorizedError } from "@/lib/authz";
import { generatePatientCode } from "@/lib/patients";

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
  bloodType: z.string().optional(),
  nationality: z.string().optional(),
  nrcNumber: z.string().optional(),
  heightCm: z.coerce.number().positive().optional(),
  weightKg: z.coerce.number().positive().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceGroupNumber: z.string().optional(),
  insuranceCoverageType: z.string().optional(),
  insurancePolicyHolder: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactAltPhone: z.string().optional(),
  emergencyContactAddress: z.string().optional(),
});

export type PatientFormState = { error?: string; success?: boolean };

// Some <Select>s use an "UNSPECIFIED" sentinel item since Radix Select items
// can't have an empty string value; treat it the same as "not set".
function readSentinel(formData: FormData, name: string) {
  const raw = formData.get(name);
  return raw && raw !== "UNSPECIFIED" ? raw : undefined;
}

function readGender(formData: FormData) {
  return readSentinel(formData, "gender");
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
    bloodType: formData.get("bloodType") || undefined,
    nationality: formData.get("nationality") || undefined,
    nrcNumber: formData.get("nrcNumber") || undefined,
    heightCm: formData.get("heightCm") || undefined,
    weightKg: formData.get("weightKg") || undefined,
    insuranceProvider: formData.get("insuranceProvider") || undefined,
    insurancePolicyNumber: formData.get("insurancePolicyNumber") || undefined,
    insuranceGroupNumber: formData.get("insuranceGroupNumber") || undefined,
    insuranceCoverageType: formData.get("insuranceCoverageType") || undefined,
    insurancePolicyHolder: formData.get("insurancePolicyHolder") || undefined,
    insuranceExpiryDate: formData.get("insuranceExpiryDate") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
    emergencyContactRelationship: formData.get("emergencyContactRelationship") || undefined,
    emergencyContactAltPhone: formData.get("emergencyContactAltPhone") || undefined,
    emergencyContactAddress: formData.get("emergencyContactAddress") || undefined,
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

  const { dob, insuranceExpiryDate, ...rest } = parsed.data;
  const patientCode = await generatePatientCode(prisma);

  await prisma.patient.create({
    data: {
      ...rest,
      patientCode,
      email: rest.email || undefined,
      dob: dob ? new Date(dob) : undefined,
      insuranceExpiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : undefined,
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

  const { dob, insuranceExpiryDate, gender, email, ...rest } = parsed.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...rest,
      gender: gender ?? null,
      email: email || null,
      dob: dob ? new Date(dob) : null,
      insuranceExpiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null,
    },
  });

  revalidatePath("/staff/patients");
  revalidatePath(`/staff/patients/${patientId}`);
  return { success: true };
}

async function requireOwnPatientId() {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");
  return patientId;
}

const personalDetailsSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  bloodType: z.string().optional(),
  nationality: z.string().optional(),
  nrcNumber: z.string().optional(),
  heightCm: z.coerce.number().positive().optional(),
  weightKg: z.coerce.number().positive().optional(),
});

export async function updatePersonalDetails(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const patientId = await requireOwnPatientId();

  const parsed = personalDetailsSchema.safeParse({
    name: formData.get("name"),
    gender: readGender(formData),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dob: formData.get("dob") || undefined,
    address: formData.get("address") || undefined,
    bloodType: readSentinel(formData, "bloodType"),
    nationality: formData.get("nationality") || undefined,
    nrcNumber: formData.get("nrcNumber") || undefined,
    heightCm: formData.get("heightCm") || undefined,
    weightKg: formData.get("weightKg") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { dob, gender, email, ...rest } = parsed.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...rest,
      gender: gender ?? null,
      email: email || null,
      dob: dob ? new Date(dob) : null,
    },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

const emergencyContactSchema = z.object({
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactAltPhone: z.string().optional(),
  emergencyContactAddress: z.string().optional(),
});

export async function updateEmergencyContact(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const patientId = await requireOwnPatientId();

  const parsed = emergencyContactSchema.safeParse({
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactRelationship: formData.get("emergencyContactRelationship") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
    emergencyContactAltPhone: formData.get("emergencyContactAltPhone") || undefined,
    emergencyContactAddress: formData.get("emergencyContactAddress") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.patient.update({ where: { id: patientId }, data: parsed.data });

  revalidatePath("/portal/settings");
  return { success: true };
}

const insuranceSchema = z.object({
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceGroupNumber: z.string().optional(),
  insuranceCoverageType: z.string().optional(),
  insurancePolicyHolder: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
});

export async function updateInsuranceInfo(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const patientId = await requireOwnPatientId();

  const parsed = insuranceSchema.safeParse({
    insuranceProvider: formData.get("insuranceProvider") || undefined,
    insurancePolicyNumber: formData.get("insurancePolicyNumber") || undefined,
    insuranceGroupNumber: formData.get("insuranceGroupNumber") || undefined,
    insuranceCoverageType: formData.get("insuranceCoverageType") || undefined,
    insurancePolicyHolder: formData.get("insurancePolicyHolder") || undefined,
    insuranceExpiryDate: formData.get("insuranceExpiryDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { insuranceExpiryDate, ...rest } = parsed.data;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...rest,
      insuranceExpiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null,
    },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

const PRIVACY_FIELDS = [
  "notifyAppointmentReminders",
  "notifyLabResults",
  "notifyPrescriptionRenewals",
  "notifyAnnouncements",
  "notifyPromotions",
  "shareRecordsWithSpecialist",
  "allowAnalytics",
] as const;
export type PrivacyField = (typeof PRIVACY_FIELDS)[number];

export async function updatePrivacySetting(field: PrivacyField, value: boolean) {
  const patientId = await requireOwnPatientId();
  if (!PRIVACY_FIELDS.includes(field)) {
    throw new Error("Invalid privacy field");
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: { [field]: value },
  });

  revalidatePath("/portal/settings");
}
