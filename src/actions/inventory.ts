"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notifyIfLowStock } from "@/lib/telegram";

const INVENTORY_ROLES = ["ADMIN", "PHARMACIST"] as const;

const medicineSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  stockQty: z.coerce.number().int().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative(),
  price: z.coerce.number().nonnegative(),
  expiryDate: z.coerce.date().optional(),
});

export type MedicineFormState = { error?: string; success?: boolean };

export async function createMedicine(
  _prevState: MedicineFormState,
  formData: FormData
): Promise<MedicineFormState> {
  await requireRole([...INVENTORY_ROLES]);

  const parsed = medicineSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit"),
    stockQty: formData.get("stockQty"),
    reorderLevel: formData.get("reorderLevel"),
    price: formData.get("price"),
    expiryDate: formData.get("expiryDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.medicine.create({ data: parsed.data });

  revalidatePath("/staff/inventory");
  return { success: true };
}

const expiryDateSchema = z.object({
  expiryDate: z.coerce.date().optional(),
});

export type SetExpiryState = { error?: string; success?: boolean };

export async function setMedicineExpiry(
  medicineId: string,
  _prevState: SetExpiryState,
  formData: FormData
): Promise<SetExpiryState> {
  await requireRole([...INVENTORY_ROLES]);

  const parsed = expiryDateSchema.safeParse({
    expiryDate: formData.get("expiryDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.medicine.update({
    where: { id: medicineId },
    data: { expiryDate: parsed.data.expiryDate ?? null },
  });

  revalidatePath("/staff/inventory");
  revalidatePath(`/staff/inventory/${medicineId}`);
  return { success: true };
}

const adjustSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().optional(),
});

export type AdjustStockState = { error?: string; success?: boolean };

export async function adjustStock(
  medicineId: string,
  _prevState: AdjustStockState,
  formData: FormData
): Promise<AdjustStockState> {
  await requireRole([...INVENTORY_ROLES]);

  const parsed = adjustSchema.safeParse({
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, quantity, reason } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (type === "OUT") {
      const medicine = await tx.medicine.findUniqueOrThrow({ where: { id: medicineId } });
      if (medicine.stockQty < quantity) {
        throw new Error("Insufficient stock");
      }
    }

    await tx.medicine.update({
      where: { id: medicineId },
      data:
        type === "IN"
          ? { stockQty: { increment: quantity } }
          : { stockQty: { decrement: quantity } },
    });

    await tx.stockTransaction.create({
      data: { medicineId, type, quantity, reason },
    });
  });

  if (type === "OUT") {
    await notifyIfLowStock(medicineId);
  }

  revalidatePath("/staff/inventory");
  return { success: true };
}
