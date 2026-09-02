"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { notifyIfLowStock, notifyPatient } from "@/lib/telegram";
import { generateReminderSchedule } from "@/lib/pill-reminders";
import { createNotification } from "@/lib/notifications";

const itemsSchema = z
  .array(
    z.object({
      medicineId: z.string().min(1),
      dosage: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
      timesPerDay: z.coerce.number().int().positive().optional(),
      durationDays: z.coerce.number().int().positive().optional(),
      frequency: z.string().optional(),
      instructions: z.string().optional(),
      refillsLeft: z.coerce.number().int().nonnegative().optional(),
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
          frequency: item.frequency,
          instructions: item.instructions,
          refillsLeft: item.refillsLeft,
        })),
      },
    },
    include: { items: true },
  });

  const medicines = await prisma.medicine.findMany({
    where: { id: { in: items.map((item) => item.medicineId) } },
  });
  const medicineById = new Map(medicines.map((m) => [m.id, m]));

  const existingInvoice = await prisma.invoice.findUnique({ where: { appointmentId } });
  if (!existingInvoice) {
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

  const medicineNames = items
    .map((item) => medicineById.get(item.medicineId)?.name)
    .filter(Boolean)
    .join(", ");
  await notifyPatient(
    appointment.patientId,
    `💊 ${appointment.doctor.user.name} wrote you a new prescription: ${medicineNames}.`
  );
  await createNotification({
    patientId: appointment.patientId,
    category: "PRESCRIPTION",
    tone: "INFO",
    title: "New Prescription",
    body: `${appointment.doctor.user.name} prescribed ${medicineNames}. Collect it from the pharmacy once ready.`,
    href: "/portal/medical-records",
    relatedId: `rx-created-${prescription.id}`,
  });

  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/portal/appointments");
  revalidatePath("/portal/medical-records");
  revalidatePath("/portal/notifications");
  return { success: true };
}

export async function fulfillPrescription(prescriptionId: string) {
  await requireRole(["PHARMACIST"]);

  const medicineIds: string[] = [];
  let notifyPatientId: string | null = null;
  let medicineNames = "";

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
    notifyPatientId = prescription.patientId;
    medicineNames = prescription.items.map((i) => i.medicine.name).join(", ");

    if (prescription.appointment && prescription.appointment.invoice?.status !== "PAID") {
      throw new Error(
        "The patient must pay their invoice before medicine can be dispensed."
      );
    }

    for (const item of prescription.items) {
      if (item.quantity != null && item.medicine.stockQty < item.quantity) {
        throw new Error(`Insufficient stock for ${item.medicine.name}`);
      }
    }

    for (const item of prescription.items) {
      if (item.quantity == null) continue;
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

  if (notifyPatientId) {
    await createNotification({
      patientId: notifyPatientId,
      category: "PRESCRIPTION",
      tone: "SUCCESS",
      title: "Prescription Ready",
      body: `Your prescription for ${medicineNames} has been processed. Collect from the pharmacy at NCA Clinic.`,
      href: "/portal/medical-records",
      relatedId: `rx-ready-${prescriptionId}`,
    });
    revalidatePath("/portal/notifications");
  }

  revalidatePath("/staff/inventory");
}

