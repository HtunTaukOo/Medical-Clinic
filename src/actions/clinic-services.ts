"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getActiveSpecialties } from "@/lib/specialties-data";

const clinicServiceSchema = z.object({
  name: z.string().min(1),
  specialty: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  room: z.string().optional(),
  active: z.enum(["on", "off"]).transform((v) => v === "on"),
});

export type ClinicServiceFormState = { error?: string; success?: boolean };

async function validateSpecialty(specialty: string | undefined) {
  if (!specialty) return null;
  const specialties = await getActiveSpecialties();
  if (!specialties.some((s) => s.name === specialty)) {
    return "Invalid specialty";
  }
  return null;
}

export async function createClinicService(
  _prevState: ClinicServiceFormState,
  formData: FormData
): Promise<ClinicServiceFormState> {
  await requireRole(["ADMIN"]);

  const parsed = clinicServiceSchema.safeParse({
    name: formData.get("name"),
    specialty: formData.get("specialty") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    room: formData.get("room") || undefined,
    active: formData.get("active") ? "on" : "off",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  await prisma.clinicService.create({ data: parsed.data });

  revalidatePath("/staff/clinic-services");
  return { success: true };
}

export async function updateClinicService(
  serviceId: string,
  _prevState: ClinicServiceFormState,
  formData: FormData
): Promise<ClinicServiceFormState> {
  await requireRole(["ADMIN"]);

  const parsed = clinicServiceSchema.safeParse({
    name: formData.get("name"),
    specialty: formData.get("specialty") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    room: formData.get("room") || undefined,
    active: formData.get("active") ? "on" : "off",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  await prisma.clinicService.update({ where: { id: serviceId }, data: parsed.data });

  revalidatePath("/staff/clinic-services");
  return { success: true };
}
