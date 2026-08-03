"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { logActivity } from "@/lib/audit";

const INVENTORY_ROLES = ["ADMIN", "PHARMACIST"] as const;

const poItemsSchema = z
  .array(
    z.object({
      medicineId: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
      unitCost: z.coerce.number().nonnegative(),
    })
  )
  .min(1);

export type PurchaseOrderFormState = { error?: string; success?: boolean };

export async function createPurchaseOrder(
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const session = await requireRole([...INVENTORY_ROLES]);

  const supplierId = formData.get("supplierId");
  if (typeof supplierId !== "string" || !supplierId) {
    return { error: "Supplier is required" };
  }

  let items;
  try {
    items = poItemsSchema.parse(JSON.parse(String(formData.get("items") ?? "[]")));
  } catch {
    return { error: "Add at least one valid line item" };
  }

  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" && notesRaw ? notesRaw : undefined;

  await prisma.purchaseOrder.create({
    data: {
      supplierId,
      createdById: session.user.id,
      notes,
      items: { create: items },
    },
  });

  revalidatePath("/staff/inventory/purchase-orders");
  return { success: true };
}

export async function markOrdered(purchaseOrderId: string) {
  const session = await requireRole([...INVENTORY_ROLES]);

  const order = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
  });
  if (order.status !== "DRAFT") {
    throw new Error("Only a draft purchase order can be marked as ordered");
  }

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: "ORDERED" },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Marked purchase order as ordered",
    target: `Purchase order ${purchaseOrderId}`,
  });

  revalidatePath("/staff/inventory/purchase-orders");
  revalidatePath(`/staff/inventory/purchase-orders/${purchaseOrderId}`);
}

export async function cancelPurchaseOrder(purchaseOrderId: string) {
  const session = await requireRole([...INVENTORY_ROLES]);

  const order = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
  });
  if (order.status === "RECEIVED" || order.status === "CANCELLED") {
    throw new Error("This purchase order can no longer be cancelled");
  }

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: "CANCELLED" },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Cancelled purchase order",
    target: `Purchase order ${purchaseOrderId}`,
  });

  revalidatePath("/staff/inventory/purchase-orders");
  revalidatePath(`/staff/inventory/purchase-orders/${purchaseOrderId}`);
}

export type ReceiveStockState = { error?: string; success?: boolean };

export async function receiveStock(
  purchaseOrderId: string,
  _prevState: ReceiveStockState,
  formData: FormData
): Promise<ReceiveStockState> {
  const session = await requireRole([...INVENTORY_ROLES]);

  const order = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (order.status !== "ORDERED" && order.status !== "PARTIALLY_RECEIVED") {
    return { error: "This purchase order is not open for receiving" };
  }

  const receipts: { itemId: string; medicineId: string; quantity: number }[] = [];
  for (const item of order.items) {
    const raw = formData.get(`receive_${item.id}`);
    const qty = raw ? Number(raw) : 0;
    if (!qty) continue;
    const remaining = item.quantity - item.receivedQty;
    if (!Number.isInteger(qty) || qty < 0 || qty > remaining) {
      return { error: "Enter a valid quantity, not exceeding what's still outstanding" };
    }
    receipts.push({ itemId: item.id, medicineId: item.medicineId, quantity: qty });
  }
  if (receipts.length === 0) {
    return { error: "Enter a quantity to receive for at least one item" };
  }

  await prisma.$transaction(async (tx) => {
    for (const receipt of receipts) {
      await tx.medicine.update({
        where: { id: receipt.medicineId },
        data: { stockQty: { increment: receipt.quantity } },
      });
      await tx.stockTransaction.create({
        data: {
          medicineId: receipt.medicineId,
          type: "IN",
          quantity: receipt.quantity,
          reason: `Received from purchase order ${purchaseOrderId}`,
        },
      });
      await tx.purchaseOrderItem.update({
        where: { id: receipt.itemId },
        data: { receivedQty: { increment: receipt.quantity } },
      });
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
    });
    const allReceived = updatedItems.every((i) => i.receivedQty >= i.quantity);
    const anyReceived = updatedItems.some((i) => i.receivedQty > 0);

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : order.status },
    });
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Received stock (${receipts.reduce((sum, r) => sum + r.quantity, 0)} units) against purchase order`,
    target: `Purchase order ${purchaseOrderId}`,
  });

  revalidatePath("/staff/inventory");
  revalidatePath("/staff/inventory/purchase-orders");
  revalidatePath(`/staff/inventory/purchase-orders/${purchaseOrderId}`);
  return { success: true };
}
