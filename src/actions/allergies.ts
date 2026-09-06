"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, UnauthorizedError, STAFF_ROLES } from "@/lib/authz";

const ALLERGY_STAFF_ROLES = [...STAFF_ROLES, "DOCTOR"] as const;

const allergySchema = z.object({
  name: z.string().min(1),
  category: z.enum(["DRUG", "FOOD", "ENVIRONMENTAL", "OTHER"]).default("OTHER"),
  reaction: z.string().optional(),
  severity: z.enum(["MILD", "MODERATE", "SEVERE"]).default("MILD"),
  firstNoted: z.string().optional(),
});

export type AllergyFormState = { error?: string; success?: boolean };

function parseAllergyForm(formData: FormData) {
  return allergySchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    reaction: formData.get("reaction") || undefined,
    severity: formData.get("severity") || undefined,
    firstNoted: formData.get("firstNoted") || undefined,
  });
}

export async function addAllergy(
  patientId: string,
  _prevState: AllergyFormState,
  formData: FormData
): Promise<AllergyFormState> {
  await requireRole([...ALLERGY_STAFF_ROLES]);

  const parsed = parseAllergyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.allergy.create({
    data: {
      patientId,
      name: parsed.data.name,
      category: parsed.data.category,
      reaction: parsed.data.reaction,
      severity: parsed.data.severity,
      firstNoted: parsed.data.firstNoted ? new Date(parsed.data.firstNoted) : undefined,
    },
  });

  revalidatePath(`/staff/patients/${patientId}`);
  revalidatePath(`/doctor/patients/${patientId}`);
  revalidatePath("/portal/medical-records");
  return { success: true };
}

export async function addOwnAllergy(
  _prevState: AllergyFormState,
  formData: FormData
): Promise<AllergyFormState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const parsed = parseAllergyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.allergy.create({
    data: {
      patientId,
      name: parsed.data.name,
      category: parsed.data.category,
      reaction: parsed.data.reaction,
      severity: parsed.data.severity,
      firstNoted: parsed.data.firstNoted ? new Date(parsed.data.firstNoted) : undefined,
    },
  });

  revalidatePath("/portal/settings");
  revalidatePath("/portal/medical-records");
  return { success: true };
}

export async function deleteAllergy(allergyId: string) {
  const session = await requireSession();

  const allergy = await prisma.allergy.findUniqueOrThrow({ where: { id: allergyId } });
  const isOwnAllergy = session.user.patientId === allergy.patientId;
  const isStaff = (ALLERGY_STAFF_ROLES as readonly string[]).includes(session.user.role);
  if (!isOwnAllergy && !isStaff) {
    throw new UnauthorizedError("Not your allergy record");
  }

  await prisma.allergy.delete({ where: { id: allergyId } });

  revalidatePath(`/staff/patients/${allergy.patientId}`);
  revalidatePath(`/doctor/patients/${allergy.patientId}`);
  revalidatePath("/portal/settings");
  revalidatePath("/portal/medical-records");
}
