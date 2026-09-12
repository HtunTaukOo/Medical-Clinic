"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { SPECIALTY_ICON_NAMES } from "@/lib/specialties";

function revalidateSpecialtyConsumers() {
  revalidatePath("/staff/settings");
  revalidatePath("/portal/book");
  revalidatePath("/staff/clinic-services");
  revalidatePath("/staff/clinic-services/new");
  revalidatePath("/staff/users/new");
  revalidatePath("/staff/doctors");
  revalidatePath("/doctor/profile");
}

const createSpecialtySchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.enum(SPECIALTY_ICON_NAMES),
  description: z.string().max(200).optional(),
  bookByService: z.enum(["on", "off"]).transform((v) => v === "on"),
  capacityPerSlot: z.coerce.number().int().min(1).max(50),
});

export type SpecialtyFormState = { error?: string; success?: boolean };

export async function createSpecialty(
  _prevState: SpecialtyFormState,
  formData: FormData
): Promise<SpecialtyFormState> {
  await requireRole(["ADMIN"]);

  const parsed = createSpecialtySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    description: formData.get("description") || undefined,
    bookByService: formData.get("bookByService") ? "on" : "off",
    capacityPerSlot: formData.get("capacityPerSlot") || 1,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.specialty.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A specialty with this name already exists" };
  }

  const count = await prisma.specialty.count();
  await prisma.specialty.create({ data: { ...parsed.data, sortOrder: count } });

  revalidateSpecialtyConsumers();
  return { success: true };
}

const editSpecialtySchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.enum(SPECIALTY_ICON_NAMES),
  description: z.string().max(200).optional(),
  bookByService: z.enum(["on", "off"]).transform((v) => v === "on"),
  capacityPerSlot: z.coerce.number().int().min(1).max(50),
});

export async function updateSpecialty(
  specialtyId: string,
  _prevState: SpecialtyFormState,
  formData: FormData
): Promise<SpecialtyFormState> {
  await requireRole(["ADMIN"]);

  const parsed = editSpecialtySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    description: formData.get("description") || undefined,
    bookByService: formData.get("bookByService") ? "on" : "off",
    capacityPerSlot: formData.get("capacityPerSlot") || 1,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const current = await prisma.specialty.findUniqueOrThrow({ where: { id: specialtyId } });
  const renamed = parsed.data.name !== current.name;

  if (renamed) {
    const conflict = await prisma.specialty.findUnique({ where: { name: parsed.data.name } });
    if (conflict) {
      return { error: "A specialty with this name already exists" };
    }
  }

  // Doctors and clinic services store the specialty as plain text (not a
  // foreign key), so a rename has to cascade to every row using the old
  // name in the same transaction, or they'd silently fall out of sync.
  await prisma.$transaction([
    prisma.specialty.update({
      where: { id: specialtyId },
      data: {
        name: parsed.data.name,
        icon: parsed.data.icon,
        description: parsed.data.description ?? null,
        bookByService: parsed.data.bookByService,
        capacityPerSlot: parsed.data.capacityPerSlot,
      },
    }),
    ...(renamed
      ? [
          prisma.doctorProfile.updateMany({
            where: { specialty: current.name },
            data: { specialty: parsed.data.name },
          }),
          prisma.clinicService.updateMany({
            where: { specialty: current.name },
            data: { specialty: parsed.data.name },
          }),
        ]
      : []),
  ]);

  revalidateSpecialtyConsumers();
  return { success: true };
}

export async function toggleSpecialtyActive(specialtyId: string) {
  await requireRole(["ADMIN"]);

  const specialty = await prisma.specialty.findUniqueOrThrow({ where: { id: specialtyId } });
  await prisma.specialty.update({
    where: { id: specialtyId },
    data: { active: !specialty.active },
  });

  revalidateSpecialtyConsumers();
}

// Doctors and clinic services reference a specialty by name (plain text, not
// a foreign key), so deleting one out from under them wouldn't error at the
// DB level — it would just silently orphan their specialty label. Block it
// instead and point the admin at deactivating, which keeps the name intact.
/* eslint-disable @typescript-eslint/no-unused-vars -- signature must match useActionState's (state, formData) */
export async function deleteSpecialty(
  specialtyId: string,
  _prevState: SpecialtyFormState,
  _formData: FormData
): Promise<SpecialtyFormState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  await requireRole(["ADMIN"]);

  const specialty = await prisma.specialty.findUniqueOrThrow({ where: { id: specialtyId } });

  const [doctorCount, serviceCount] = await Promise.all([
    prisma.doctorProfile.count({ where: { specialty: specialty.name } }),
    prisma.clinicService.count({ where: { specialty: specialty.name } }),
  ]);
  if (doctorCount > 0 || serviceCount > 0) {
    return {
      error: `Can't delete — ${specialty.name} is still assigned to ${doctorCount} doctor${doctorCount === 1 ? "" : "s"} and ${serviceCount} clinic service${serviceCount === 1 ? "" : "s"}. Reassign those first, or deactivate it instead.`,
    };
  }

  await prisma.specialty.delete({ where: { id: specialtyId } });

  revalidateSpecialtyConsumers();
  return { success: true };
}
