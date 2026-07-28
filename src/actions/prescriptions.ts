"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { notifyIfLowStock } from "@/lib/telegram";
import { generateReminderSchedule } from "@/lib/pill-reminders";

const itemsSchema = z
  .array(
    z.object({
      medicineId: z.string().min(1),
      dosage: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
      timesPerDay: z.coerce.number().int().positive().optional(),
      durationDays: z.coerce.number().int().positive().optional(),
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
    include: { doctor: { include: { user: true } } },
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

  const prescription = await prisma.prescription.create({
    data: {
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      items: {
        create: items.map((item) => ({
          medicineId: item.medicineId,
          dosage: item.dosage,
          quantity: item.quantity,
          timesPerDay: item.timesPerDay,
          durationDays: item.durationDays,
        })),
      },
    },
    include: { items: true },
  });

  const existingInvoice = await prisma.invoice.findUnique({ where: { appointmentId } });
  if (!existingInvoice) {
    const medicines = await prisma.medicine.findMany({
      where: { id: { in: items.map((item) => item.medicineId) } },
    });
    const medicineById = new Map(medicines.map((m) => [m.id, m]));

    const invoiceItems = items.map((item) => {
      const medicine = medicineById.get(item.medicineId)!;
      return {
        description: `${medicine.name} (${item.dosage})`,
        quantity: item.quantity,
        unitPrice: medicine.price,
      };
    });

    const consultationFee = Number(appointment.doctor.consultationFee);
    if (consultationFee > 0) {
      invoiceItems.unshift({
        description: `Consultation — ${appointment.doctor.user.name}`,
        quantity: 1,
        unitPrice: appointment.doctor.consultationFee,
      });
    }

    const total = invoiceItems.reduce(
      (sum, item) => sum + item.quantity * Number(item.unitPrice),
      0
    );

    await prisma.invoice.create({
      data: {
        patientId: appointment.patientId,
        appointmentId,
        total,
        items: { create: invoiceItems },
      },
    });

    revalidatePath("/staff/billing");
    revalidatePath("/portal/invoices");
  }

  const now = new Date();
  for (const item of prescription.items) {
    if (item.timesPerDay && item.durationDays) {
      const schedule = generateReminderSchedule(now, item.timesPerDay, item.durationDays, now);
      if (schedule.length > 0) {
        await prisma.pillReminder.createMany({
          data: schedule.map((scheduledFor) => ({
            prescriptionItemId: item.id,
            patientId: appointment.patientId,
            scheduledFor,
          })),
        });
      }
    }
  }

  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/portal/appointments");
  return { success: true };
}

export async function fulfillPrescription(prescriptionId: string) {
  await requireRole(["PHARMACIST"]);

  const medicineIds: string[] = [];

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
      medicineIds.push(item.medicineId);
    }

    await tx.prescription.update({
      where: { id: prescriptionId },
      data: { fulfilled: true, fulfilledAt: new Date() },
    });
  });

  for (const medicineId of medicineIds) {
    await notifyIfLowStock(medicineId);
  }

  revalidatePath("/staff/inventory");
}
