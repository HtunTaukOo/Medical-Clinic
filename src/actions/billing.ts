"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

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
