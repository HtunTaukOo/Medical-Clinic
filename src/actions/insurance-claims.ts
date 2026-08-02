"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { logActivity } from "@/lib/audit";
import { recomputeInvoiceStatus } from "@/actions/billing";

const BILLING_STAFF_ROLES = ["ADMIN", "RECEPTIONIST"] as const;

const submitClaimSchema = z.object({
  insuranceProvider: z.string().min(1),
  policyNumber: z.string().min(1),
  claimedAmount: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export type ClaimFormState = { error?: string; success?: boolean };

export async function submitClaim(
  invoiceId: string,
  _prevState: ClaimFormState,
  formData: FormData
): Promise<ClaimFormState> {
  const session = await requireRole([...BILLING_STAFF_ROLES]);

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  const parsed = submitClaimSchema.safeParse({
    insuranceProvider: formData.get("insuranceProvider"),
    policyNumber: formData.get("policyNumber"),
    claimedAmount: formData.get("claimedAmount"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.claimedAmount > Number(invoice.total)) {
    return { error: `Cannot claim more than the invoice total (${Number(invoice.total).toFixed(2)})` };
  }

  await prisma.insuranceClaim.create({
    data: {
      invoiceId,
      patientId: invoice.patientId,
      insuranceProvider: parsed.data.insuranceProvider,
      policyNumber: parsed.data.policyNumber,
      claimedAmount: parsed.data.claimedAmount,
      notes: parsed.data.notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Submitted insurance claim to ${parsed.data.insuranceProvider} for ${parsed.data.claimedAmount.toFixed(2)}`,
    target: `Invoice ${invoiceId}`,
  });

  revalidatePath("/staff/billing/claims");
  revalidatePath(`/staff/billing/${invoiceId}`);
  return { success: true };
}

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  approvedAmount: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

export type ClaimDecisionState = { error?: string; success?: boolean };

export async function decideClaim(
  claimId: string,
  _prevState: ClaimDecisionState,
  formData: FormData
): Promise<ClaimDecisionState> {
  const session = await requireRole([...BILLING_STAFF_ROLES]);

  const claim = await prisma.insuranceClaim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.status !== "SUBMITTED") {
    return { error: "This claim has already been decided" };
  }

  const parsed = decisionSchema.safeParse({
    status: formData.get("status"),
    approvedAmount: formData.get("approvedAmount") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.status === "APPROVED") {
    if (!parsed.data.approvedAmount) {
      return { error: "An approved amount is required" };
    }
    if (parsed.data.approvedAmount > Number(claim.claimedAmount)) {
      return { error: "Approved amount cannot exceed the claimed amount" };
    }
  }

  await prisma.insuranceClaim.update({
    where: { id: claimId },
    data: {
      status: parsed.data.status,
      approvedAmount: parsed.data.status === "APPROVED" ? parsed.data.approvedAmount : null,
      notes: parsed.data.notes ?? claim.notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `${parsed.data.status === "APPROVED" ? "Approved" : "Rejected"} insurance claim${
      parsed.data.status === "APPROVED" ? ` for ${parsed.data.approvedAmount!.toFixed(2)}` : ""
    }`,
    target: `Invoice ${claim.invoiceId}`,
  });

  revalidatePath("/staff/billing/claims");
  revalidatePath(`/staff/billing/${claim.invoiceId}`);
  return { success: true };
}

export async function markClaimPaid(claimId: string) {
  const session = await requireRole([...BILLING_STAFF_ROLES]);

  const claim = await prisma.insuranceClaim.findUniqueOrThrow({ where: { id: claimId } });
  if (claim.status !== "APPROVED" || !claim.approvedAmount) {
    throw new Error("Only an approved claim can be marked paid");
  }
  if (claim.paymentId) {
    throw new Error("This claim has already been paid");
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        invoiceId: claim.invoiceId,
        amount: claim.approvedAmount!,
        method: "INSURANCE",
      },
    });
    await tx.insuranceClaim.update({
      where: { id: claimId },
      data: { status: "PAID", paymentId: payment.id },
    });
  });
  await recomputeInvoiceStatus(claim.invoiceId);

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: `Recorded insurance payout of ${Number(claim.approvedAmount).toFixed(2)}`,
    target: `Invoice ${claim.invoiceId}`,
  });

  revalidatePath("/staff/billing");
  revalidatePath("/staff/billing/claims");
  revalidatePath(`/staff/billing/${claim.invoiceId}`);
}
