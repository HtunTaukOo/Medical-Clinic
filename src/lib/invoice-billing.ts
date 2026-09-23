import { prisma } from "@/lib/prisma";
import { recomputeInvoiceStatus } from "@/actions/billing";

export type BillableLineItem = { description: string; quantity: number; unitPrice: number };

// Bills the given items onto an appointment's invoice — creates one if none
// exists yet, or merges into an already-existing UNPAID/PARTIAL one instead
// of silently skipping. Several independent things can each be the first to
// bill an appointment (the consultation fee on completion, a prescription,
// a lab order) — without merging, whichever of them runs second/third would
// find an invoice already there and drop its own charges. A PAID invoice is
// left alone, matching addInvoiceItem's "can't edit a paid invoice" rule
// used elsewhere in billing.
export async function billAppointmentItems(
  patientId: string,
  appointmentId: string,
  items: BillableLineItem[]
) {
  if (items.length === 0) return;
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const existingInvoice = await prisma.invoice.findUnique({ where: { appointmentId } });
  if (existingInvoice) {
    if (existingInvoice.status === "PAID") return;
    await prisma.invoiceItem.createMany({
      data: items.map((item) => ({ invoiceId: existingInvoice.id, ...item })),
    });
    await recomputeInvoiceStatus(existingInvoice.id);
    return;
  }

  await prisma.invoice.create({
    data: { patientId, appointmentId, total, items: { create: items } },
  });
}

// Bills the doctor's consultation fee onto an appointment's invoice exactly
// once, no matter which trigger gets there first — the doctor finishing the
// consultation, writing a prescription, or ordering a lab test. Checks the
// invoice's existing items for this same line before adding another, so
// calling it more than once for the same visit is always safe.
export async function ensureConsultationFeeBilled(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: { include: { user: true } } },
  });
  if (!appointment) return;

  const fee = Number(appointment.doctor.consultationFee);
  if (fee <= 0) return;

  const description = `Consultation — ${appointment.doctor.user.name}`;
  const existingInvoice = await prisma.invoice.findUnique({
    where: { appointmentId },
    include: { items: true },
  });

  if (existingInvoice) {
    if (existingInvoice.status === "PAID") return;
    if (existingInvoice.items.some((item) => item.description === description)) return;
    await prisma.invoiceItem.create({
      data: { invoiceId: existingInvoice.id, description, quantity: 1, unitPrice: fee },
    });
    await recomputeInvoiceStatus(existingInvoice.id);
    return;
  }

  await prisma.invoice.create({
    data: {
      patientId: appointment.patientId,
      appointmentId,
      total: fee,
      items: { create: [{ description, quantity: 1, unitPrice: fee }] },
    },
  });
}
