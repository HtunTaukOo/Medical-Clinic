"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, requireRole, STAFF_ROLES, UnauthorizedError } from "@/lib/authz";
import { notifyStaffUsers } from "@/lib/notifications";

export type MedicineRequestState = { error?: string; success?: boolean };

async function staffRecipientIds() {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] }, active: true },
    select: { id: true },
  });
  return staff.map((u) => u.id);
}

const noteSchema = z.object({
  note: z.string().max(500).optional(),
});

// "Request Refill" — a patient asking staff to prepare their whole
// prescription again. Not an online sale: no payment, no stock change here —
// just a queue entry staff see on /staff/pharmacy and complete in person.
export async function requestMedicineRefill(
  prescriptionId: string,
  _prevState: MedicineRequestState,
  formData: FormData
): Promise<MedicineRequestState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const prescription = await prisma.prescription.findUnique({ where: { id: prescriptionId } });
  if (!prescription || prescription.patientId !== patientId) {
    throw new UnauthorizedError("Not your prescription");
  }

  const existing = await prisma.medicineRequest.findFirst({
    where: { patientId, prescriptionId, status: "PENDING" },
  });
  if (existing) return { error: "You already have a pending request for this prescription." };

  const parsed = noteSchema.safeParse({ note: formData.get("note") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const request = await prisma.medicineRequest.create({
    data: { patientId, prescriptionId, note: parsed.data.note, status: "PENDING" },
  });

  await notifyStaffUsers({
    userIds: await staffRecipientIds(),
    category: "PHARMACY",
    tone: "INFO",
    title: "Refill Request",
    body: `${session.user.name ?? "A patient"} requested a refill for one of their prescriptions.`,
    href: "/staff/pharmacy?tab=requests",
    relatedId: `medreq-${request.id}`,
  });

  revalidatePath("/portal/medicines");
  revalidatePath("/staff/pharmacy");
  return { success: true };
}

// "Notify Pharmacy" — a patient flagging interest in a catalog medicine
// (with no prescription behind it) so staff can prepare/reserve it.
export async function requestMedicineNotify(
  medicineId: string,
  _prevState: MedicineRequestState,
  formData: FormData
): Promise<MedicineRequestState> {
  const session = await requireSession();
  const patientId = session.user.patientId;
  if (!patientId) throw new UnauthorizedError("No patient profile");

  const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
  if (!medicine) return { error: "Medicine not found." };

  const existing = await prisma.medicineRequest.findFirst({
    where: { patientId, medicineId, status: "PENDING" },
  });
  if (existing) return { error: "You already have a pending request for this medicine." };

  const parsed = z
    .object({
      note: z.string().max(500).optional(),
      quantity: z.coerce.number().int().positive().optional(),
    })
    .safeParse({
      note: formData.get("note") || undefined,
      quantity: formData.get("quantity") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const request = await prisma.medicineRequest.create({
    data: {
      patientId,
      medicineId,
      quantity: parsed.data.quantity,
      note: parsed.data.note,
      status: "PENDING",
    },
  });

  await notifyStaffUsers({
    userIds: await staffRecipientIds(),
    category: "PHARMACY",
    tone: "INFO",
    title: "Pharmacy Notification Request",
    body: `${session.user.name ?? "A patient"} wants to be notified about ${medicine.name}.`,
    href: "/staff/pharmacy?tab=requests",
    relatedId: `medreq-${request.id}`,
  });

  revalidatePath("/portal/medicines");
  revalidatePath("/staff/pharmacy");
  return { success: true };
}

// No standalone "mark complete" action — a request is only ever completed
// as a side effect of actually selling the medicine (see completeSale in
// src/actions/pharmacy.ts, which sets status COMPLETED when a sale carries
// a requestId). Dismissing without a sale uses cancelMedicineRequest below.
export async function cancelMedicineRequest(requestId: string) {
  const session = await requireRole(STAFF_ROLES);
  await prisma.medicineRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      completedById: session.user.id,
      completedByName: session.user.name ?? "Staff",
      completedAt: new Date(),
    },
  });
  revalidatePath("/staff/pharmacy");
}
