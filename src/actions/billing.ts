"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { logActivity } from "@/lib/audit";

const BILLING_STAFF_ROLES = ["ADMIN", "RECEPTIONIST"] as const;

const itemsSchema = z
  .array(
    z.object({
      description: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().nonnegative(),
    })
  )
  .min(1);

export type InvoiceFormState = { error?: string; success?: boolean };

export async function createInvoice(
  _prevState: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  await requireRole([...BILLING_STAFF_ROLES]);

  const patientId = formData.get("patientId");
  if (typeof patientId !== "string" || !patientId) {
    return { error: "Patient is required" };
  }
  const appointmentIdRaw = formData.get("appointmentId");
  const appointmentId =
    typeof appointmentIdRaw === "string" && appointmentIdRaw ? appointmentIdRaw : undefined;

  let items;
  try {
    items = itemsSchema.parse(JSON.parse(String(formData.get("items") ?? "[]")));
  } catch {
    return { error: "Add at least one valid line item" };
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  if (appointmentId) {
    const existing = await prisma.invoice.findUnique({ where: { appointmentId } });
    if (existing) {
      return { error: "This appointment already has an invoice" };
    }
  }

  await prisma.invoice.create({
    data: {
      patientId,
      appointmentId,
      total,
      items: { create: items },
    },
  });

  revalidatePath("/staff/billing");
  if (appointmentId) revalidatePath(`/staff/appointments/${appointmentId}`);
  return { success: true };
}

export async function recomputeInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true, payments: { include: { refunds: true } } },
  });
  const total = invoice.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.unitPrice),
    0
  );
  const paid = invoice.payments.reduce((sum, p) => {
    const refunded = p.refunds.reduce((s, r) => s + Number(r.amount), 0);
    return sum + Number(p.amount) - refunded;
  }, 0);
  const status = paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

  await prisma.invoice.update({ where: { id: invoiceId }, data: { total, status } });
}

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

export type InvoiceItemFormState = { error?: string; success?: boolean };

export async function addInvoiceItem(
  invoiceId: string,
  _prevState: InvoiceItemFormState,
  formData: FormData
): Promise<InvoiceItemFormState> {
  const session = await requireRole([...BILLING_STAFF_ROLES]);

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.status === "PAID") {
    return { error: "This invoice is already fully paid and can no longer be edited" };
  }

  const parsed = invoiceItemSchema.safeParse({
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.invoiceItem.create({ data: { invoiceId, ...parsed.data } });
  await recomputeInvoiceStatus(invoiceId);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Added invoice item "${parsed.data.description}" (${parsed.data.quantity} x ${parsed.data.unitPrice})`,
    target: `Invoice ${invoiceId}`,
  });

  revalidatePath("/staff/billing");
  revalidatePath(`/staff/billing/${invoiceId}`);
  return { success: true };
}

export async function removeInvoiceItem(invoiceId: string, itemId: string) {
  const session = await requireRole([...BILLING_STAFF_ROLES]);

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true },
  });
  if (invoice.status === "PAID") {
    throw new Error("This invoice is already fully paid and can no longer be edited");
  }
  if (invoice.items.length <= 1) {
    throw new Error("An invoice must have at least one line item");
  }

  const item = invoice.items.find((i) => i.id === itemId);

  await prisma.invoiceItem.delete({ where: { id: itemId } });
  await recomputeInvoiceStatus(invoiceId);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Removed invoice item "${item?.description ?? itemId}"`,
    target: `Invoice ${invoiceId}`,
  });

  revalidatePath("/staff/billing");
  revalidatePath(`/staff/billing/${invoiceId}`);
}

export async function voidPayment(invoiceId: string, paymentId: string) {
  const session = await requireRole(["ADMIN"]);

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  await prisma.payment.delete({ where: { id: paymentId } });
  await recomputeInvoiceStatus(invoiceId);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Voided payment of ${payment ? Number(payment.amount).toFixed(2) : "?"} (${payment?.method ?? "unknown method"})`,
    target: `Invoice ${invoiceId}`,
  });

  revalidatePath("/staff/billing");
  revalidatePath(`/staff/billing/${invoiceId}`);
}

const refundSchema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().optional(),
});

export type RefundFormState = { error?: string; success?: boolean };

export async function refundPayment(
  invoiceId: string,
  paymentId: string,
  _prevState: RefundFormState,
  formData: FormData
): Promise<RefundFormState> {
  const session = await requireRole(["ADMIN"]);

  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { refunds: true },
  });

  const parsed = refundSchema.safeParse({
    amount: formData.get("amount"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const refundable = Number(payment.amount) - alreadyRefunded;
  if (parsed.data.amount > refundable) {
    return { error: `Cannot refund more than ${refundable.toFixed(2)}` };
  }

  await prisma.refund.create({
    data: { paymentId, amount: parsed.data.amount, reason: parsed.data.reason },
  });
  await recomputeInvoiceStatus(invoiceId);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Refunded ${parsed.data.amount.toFixed(2)} on payment ${paymentId}${parsed.data.reason ? ` (${parsed.data.reason})` : ""}`,
    target: `Invoice ${invoiceId}`,
  });

  revalidatePath("/staff/billing");
  revalidatePath(`/staff/billing/${invoiceId}`);
  return { success: true };
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["CASH", "CARD", "MOBILE_BANKING", "OTHER"]),
});

export type PaymentFormState = { error?: string; success?: boolean };

export async function recordPayment(
  invoiceId: string,
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  await requireRole([...BILLING_STAFF_ROLES]);

  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId,
        amount: parsed.data.amount,
        method: parsed.data.method,
      },
    });

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payments: true },
    });
    const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const status =
      paid >= Number(invoice.total) ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  });

  revalidatePath("/staff/billing");
  revalidatePath(`/staff/billing/${invoiceId}`);
  return { success: true };
}
