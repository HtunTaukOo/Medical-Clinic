"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { notifyIfLowStock } from "@/lib/telegram";
import { createNotification } from "@/lib/notifications";
import { recomputeInvoiceStatus } from "@/actions/billing";

const saleItemSchema = z.object({
  medicineId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const saleSchema = z.object({
  patientId: z.string().min(1),
  prescriptionId: z.string().optional(),
  // Set when this sale was started from a Patient Request's "Sell" link —
  // completing the sale also marks that request COMPLETED.
  requestId: z.string().optional(),
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
    requestId: formData.get("requestId") || undefined,
    items,
    discount: formData.get("discount") || 0,
    paymentMethod: formData.get("paymentMethod"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { patientId, prescriptionId, requestId, items: saleItems, discount, paymentMethod } =
    parsed.data;

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

      // A pharmacy sale is billed and paid in the same step (no separate
      // "receive payment" flow like appointment invoices), so the invoice is
      // created already PAID. Line items mirror the sale items; a discount
      // becomes its own negative-amount line so items still sum to `total`
      // — recomputeInvoiceStatus (run after any later refund) recomputes
      // `total` straight from the item sum, so this has to hold or a
      // discounted sale's total would silently drift back up after a return.
      const invoiceItems: { description: string; quantity: number; unitPrice: number }[] =
        saleItems.map((item) => ({
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
      if (discount > 0) {
        invoiceItems.push({ description: "Discount", quantity: 1, unitPrice: -discount });
      }
      await tx.invoice.create({
        data: {
          patientId,
          pharmacySaleId: sale.id,
          total,
          status: "PAID",
          items: { create: invoiceItems },
          payments: { create: [{ amount: total, method: paymentMethod }] },
        },
      });

      if (requestId) {
        // updateMany (not update) so a stale/already-handled request id from
        // an old "Sell" link just no-ops instead of throwing.
        await tx.medicineRequest.updateMany({
          where: { id: requestId, status: "PENDING" },
          data: {
            status: "COMPLETED",
            completedById: session.user.id,
            completedByName: session.user.name ?? "Staff",
            completedAt: new Date(),
          },
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
  revalidatePath("/staff/billing");
  revalidatePath("/staff/reports");
  return { success: true, saleId };
}

export async function processReturn(saleId: string) {
  await requireRole(STAFF_ROLES);

  const invoiceId = await prisma.$transaction(async (tx) => {
    const sale = await tx.pharmacySale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true, invoice: { include: { payments: true } } },
    });
    if (sale.status === "RETURNED") return null;

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

    // Refund the full sale amount on the linked invoice's payment, so the
    // return is reflected in billing/reports the same way an appointment
    // invoice refund would be.
    const payment = sale.invoice?.payments[0];
    if (payment) {
      await tx.refund.create({
        data: { paymentId: payment.id, amount: payment.amount, reason: "Pharmacy sale returned" },
      });
    }

    return sale.invoice?.id ?? null;
  });

  if (invoiceId) {
    await recomputeInvoiceStatus(invoiceId);
  }

  revalidatePath("/staff/pharmacy");
  revalidatePath("/staff/inventory");
  revalidatePath("/staff/billing");
}
