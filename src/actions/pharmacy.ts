"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { notifyIfLowStock } from "@/lib/telegram";
import { createNotification } from "@/lib/notifications";

const saleItemSchema = z.object({
  medicineId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const saleSchema = z.object({
  patientId: z.string().min(1),
  prescriptionId: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
  discount: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "CARD", "INSURANCE"]),
});

export type CompleteSaleState = { error?: string; success?: boolean; saleId?: string };

export async function completeSale(
  _prevState: CompleteSaleState,
  formData: FormData
): Promise<CompleteSaleState> {
  const session = await requireRole(STAFF_ROLES);

  let items;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Invalid sale items" };
  }

  const parsed = saleSchema.safeParse({
    patientId: formData.get("patientId"),
    prescriptionId: formData.get("prescriptionId") || undefined,
    items,
    discount: formData.get("discount") || 0,
    paymentMethod: formData.get("paymentMethod"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { patientId, prescriptionId, items: saleItems, discount, paymentMethod } = parsed.data;

  const subtotal = saleItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);

  let saleId: string;
  try {
    saleId = await prisma.$transaction(async (tx) => {
      for (const item of saleItems) {
        const medicine = await tx.medicine.findUniqueOrThrow({ where: { id: item.medicineId } });
        if (medicine.stockQty < item.quantity) {
          throw new Error(`Insufficient stock for ${medicine.name}`);
        }
      }

      for (const item of saleItems) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stockQty: { decrement: item.quantity } },
        });
        await tx.stockTransaction.create({
          data: {
            medicineId: item.medicineId,
            type: "OUT",
            quantity: item.quantity,
            reason: "Pharmacy sale",
          },
        });
      }

      const sale = await tx.pharmacySale.create({
        data: {
          patientId,
          prescriptionId,
          soldById: session.user.id,
          subtotal,
          discount,
          total,
          paymentMethod,
          items: {
            create: saleItems.map((item) => ({
              medicineId: item.medicineId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });

      if (prescriptionId) {
        await tx.prescription.update({
          where: { id: prescriptionId },
          data: { fulfilled: true, fulfilledAt: new Date() },
        });
      }

      return sale.id;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sale failed" };
  }

  for (const item of saleItems) {
    await notifyIfLowStock(item.medicineId);
  }

  if (prescriptionId) {
    await createNotification({
      patientId,
      category: "PRESCRIPTION",
      tone: "SUCCESS",
      title: "Prescription Ready",
      body: "Your prescribed medicines have been dispensed. Collect from the pharmacy at NCA Clinic.",
      href: "/portal/medical-records",
      relatedId: `rx-ready-${prescriptionId}`,
    });
    revalidatePath("/portal/notifications");
  }

  revalidatePath("/staff/pharmacy");
  revalidatePath("/staff/inventory");
  return { success: true, saleId };
}

export async function processReturn(saleId: string) {
  await requireRole(STAFF_ROLES);

  await prisma.$transaction(async (tx) => {
    const sale = await tx.pharmacySale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true },
    });
    if (sale.status === "RETURNED") return;

    for (const item of sale.items) {
      await tx.medicine.update({
        where: { id: item.medicineId },
        data: { stockQty: { increment: item.quantity } },
      });
      await tx.stockTransaction.create({
        data: {
          medicineId: item.medicineId,
          type: "IN",
          quantity: item.quantity,
          reason: `Pharmacy return: sale ${saleId}`,
        },
      });
    }

    await tx.pharmacySale.update({
      where: { id: saleId },
      data: { status: "RETURNED", returnedAt: new Date() },
    });
  });

  revalidatePath("/staff/pharmacy");
  revalidatePath("/staff/inventory");
}
