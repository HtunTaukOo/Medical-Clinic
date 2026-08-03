"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const INVENTORY_ROLES = ["ADMIN", "PHARMACIST"] as const;

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});

export type SupplierFormState = { error?: string; success?: boolean };

export async function createSupplier(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  await requireRole([...INVENTORY_ROLES]);

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.supplier.create({ data: parsed.data });

  revalidatePath("/staff/inventory/suppliers");
  return { success: true };
}

export async function toggleSupplierActive(supplierId: string) {
  await requireRole([...INVENTORY_ROLES]);

  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { active: !supplier.active },
  });

  revalidatePath("/staff/inventory/suppliers");
}
