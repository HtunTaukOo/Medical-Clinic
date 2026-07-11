"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";

const itemsSchema = z
  .array(
    z.object({
      medicineId: z.string().min(1),
      dosage: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
    })
  )
  .min(1);

export type PrescriptionFormState = { error?: string; success?: boolean };

export async function createPrescription(
  appointmentId: string,
  _prevState: PrescriptionFormState,
  formData: FormData
): Promise<PrescriptionFormState> {
  const session = await requireRole(["DOCTOR"]);

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment || appointment.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your appointment");
  }

  let items;
  try {
    items = itemsSchema.parse(JSON.parse(String(formData.get("items") ?? "[]")));
  } catch {
    return { error: "Add at least one valid medicine item" };
  }

  await prisma.prescription.create({
    data: {
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      items: {
        create: items.map((item) => ({
          medicineId: item.medicineId,
          dosage: item.dosage,
          quantity: item.quantity,
        })),
      },
    },
  });

  revalidatePath(`/staff/appointments/${appointmentId}`);
  return { success: true };
}

export async function fulfillPrescription(prescriptionId: string) {
  await requireRole(["PHARMACIST"]);

  await prisma.$transaction(async (tx) => {
    const prescription = await tx.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: { include: { medicine: true } },
        appointment: { include: { invoice: true } },
      },
    });
    if (!prescription) throw new Error("Prescription not found");
    if (prescription.fulfilled) return;

    if (prescription.appointment.invoice?.status !== "PAID") {
      throw new Error(
        "The patient must pay their invoice before medicine can be dispensed."
      );
    }

    for (const item of prescription.items) {
      if (item.medicine.stockQty < item.quantity) {
        throw new Error(`Insufficient stock for ${item.medicine.name}`);
      }
    }

    for (const item of prescription.items) {
      await tx.medicine.update({
        where: { id: item.medicineId },
        data: { stockQty: { decrement: item.quantity } },
      });
      await tx.stockTransaction.create({
        data: {
          medicineId: item.medicineId,
          type: "OUT",
          quantity: item.quantity,
          reason: `Prescription ${prescriptionId}`,
        },
      });
    }

    await tx.prescription.update({
      where: { id: prescriptionId },
      data: { fulfilled: true, fulfilledAt: new Date() },
    });
  });

  revalidatePath("/staff/inventory");
}
