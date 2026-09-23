"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";
import { MAX_FILE_SIZE_BYTES } from "@/lib/medical-records";

const createReferralSchema = z.object({
  patientId: z.string().min(1),
  referredLabName: z.string().trim().min(1).max(200),
  testIds: z.array(z.string().min(1)).min(1),
  sampleCollectedAt: z.coerce.date(),
  requestedAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});

export type CreateExternalLabReferralState = { error?: string; success?: boolean };

export async function createExternalLabReferral(
  _prevState: CreateExternalLabReferralState,
  formData: FormData
): Promise<CreateExternalLabReferralState> {
  const session = await requireRole(STAFF_ROLES);

  const parsed = createReferralSchema.safeParse({
    patientId: formData.get("patientId"),
    referredLabName: formData.get("referredLabName"),
    testIds: formData.getAll("testIds"),
    sampleCollectedAt: formData.get("sampleCollectedAt"),
    requestedAt: formData.get("requestedAt"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Select a patient, a lab, and at least one test" };
  }

  const tests = await prisma.labTest.findMany({ where: { id: { in: parsed.data.testIds } } });
  if (tests.length === 0) {
    return { error: "Select at least one test" };
  }

  await prisma.externalLabReferral.create({
    data: {
      patientId: parsed.data.patientId,
      referredLabName: parsed.data.referredLabName,
      sampleCollectedAt: parsed.data.sampleCollectedAt,
      requestedAt: parsed.data.requestedAt,
      notes: parsed.data.notes,
      createdById: session.user.id,
      createdByName: session.user.name ?? session.user.email ?? "Staff",
      items: { create: tests.map((test) => ({ labTestId: test.id })) },
    },
  });

  revalidatePath("/staff/lab");
  return { success: true };
}

export async function markExternalLabReferralReceived(referralId: string) {
  const session = await requireRole(STAFF_ROLES);

  const referral = await prisma.externalLabReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.status !== "SENDING") return;

  await prisma.externalLabReferral.update({
    where: { id: referralId },
    data: {
      status: "RECEIVED",
      receivedById: session.user.id,
      receivedByName: session.user.name ?? session.user.email ?? "Staff",
      receivedAt: new Date(),
    },
  });

  revalidatePath("/staff/lab");
}

export async function cancelExternalLabReferral(referralId: string) {
  const session = await requireRole(STAFF_ROLES);

  const referral = await prisma.externalLabReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.status !== "SENDING") return;

  await prisma.externalLabReferral.update({
    where: { id: referralId },
    data: {
      status: "CANCELLED",
      cancelledById: session.user.id,
      cancelledByName: session.user.name ?? session.user.email ?? "Staff",
      cancelledAt: new Date(),
    },
  });

  revalidatePath("/staff/lab");
}

export type EnterExternalLabReferralResultsState = { error?: string; success?: boolean };

const VALID_RESULT_STATUSES = new Set(["NORMAL", "BORDERLINE", "LOW", "HIGH"]);

export async function enterExternalLabReferralResults(
  referralId: string,
  _prevState: EnterExternalLabReferralResultsState,
  formData: FormData
): Promise<EnterExternalLabReferralResultsState> {
  await requireRole(STAFF_ROLES);

  const referral = await prisma.externalLabReferral.findUnique({
    where: { id: referralId },
    include: { items: true },
  });
  if (!referral) {
    return { error: "Referral not found" };
  }
  if (referral.status !== "RECEIVED") {
    return { error: "Mark the referral received before entering results" };
  }

  const file = formData.get("document");
  let documentName: string | undefined;
  let documentType: string | undefined;
  let documentData: Uint8Array<ArrayBuffer> | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: "Document is too large (max 10MB)" };
    }
    documentName = file.name;
    documentType = file.type || "application/octet-stream";
    documentData = new Uint8Array(await file.arrayBuffer());
  }
  if (documentData) {
    await prisma.externalLabReferral.update({
      where: { id: referralId },
      data: { documentName, documentType, documentData },
    });
  }

  for (const item of referral.items) {
    const value = formData.get(`result-${item.id}`);
    const note = formData.get(`note-${item.id}`);
    const status = formData.get(`status-${item.id}`);
    await prisma.externalLabReferralItem.update({
      where: { id: item.id },
      data: {
        resultValue: typeof value === "string" && value ? value : null,
        resultNote: typeof note === "string" && note ? note : null,
        resultStatus:
          typeof status === "string" && VALID_RESULT_STATUSES.has(status)
            ? (status as "NORMAL" | "BORDERLINE" | "LOW" | "HIGH")
            : null,
        resultEnteredAt: new Date(),
      },
    });
  }

  revalidatePath("/staff/lab");
  revalidatePath(`/staff/lab/external/${referralId}`);
  return { success: true };
}
