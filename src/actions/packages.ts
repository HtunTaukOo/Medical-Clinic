"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const BILLING_STAFF_ROLES = ["ADMIN", "RECEPTIONIST"] as const;

const packageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
});

export type PackageFormState = { error?: string; success?: boolean };

export async function createPackage(
  _prevState: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  await requireRole([...BILLING_STAFF_ROLES]);

  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.package.create({ data: parsed.data });

  revalidatePath("/staff/billing/packages");
  return { success: true };
}

export async function togglePackageActive(packageId: string) {
  await requireRole([...BILLING_STAFF_ROLES]);

  const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
  await prisma.package.update({
    where: { id: packageId },
    data: { active: !pkg.active },
  });

  revalidatePath("/staff/billing/packages");
}
