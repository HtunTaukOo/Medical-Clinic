"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError, STAFF_ROLES } from "@/lib/authz";
import { notifyStaff, notifyPatient, notifyDoctor } from "@/lib/telegram";
import { createNotification, notifyStaffUsers } from "@/lib/notifications";
import { LAB_TEST_CATEGORIES } from "@/lib/lab-categories";
import { billAppointmentItems, ensureConsultationFeeBilled } from "@/lib/invoice-billing";

// Bills the ordered tests onto the patient's invoice — merged into the
// appointment's existing invoice (or a new one) when this order is tied to
// an appointment, so lab charges never go silently unbilled just because a
// prescription or the consultation fee already created one first. A walk-in
// order with no appointmentId (the standalone "New Test" tab) always gets
// its own invoice instead, since there's no appointment to attach it to.
async function billLabTestsToInvoice(
  patientId: string,
  appointmentId: string | undefined,
  tests: { name: string; price: unknown }[]
) {
  const items = tests.map((test) => ({
    description: `Lab Test — ${test.name}`,
    quantity: 1,
    unitPrice: Number(test.price),
  }));

  if (appointmentId) {
    await billAppointmentItems(patientId, appointmentId, items);
    return;
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  await prisma.invoice.create({
    data: { patientId, total, items: { create: items } },
  });
}

const labTestSchema = z.object({
  name: z.string().min(1),
  unit: z.string().optional(),
  normalRange: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  category: z.enum(LAB_TEST_CATEGORIES),
  requiresExternalLab: z.enum(["on", "off"]).transform((v) => v === "on"),
});

export type LabTestFormState = { error?: string; success?: boolean };

function parseLabTestForm(formData: FormData) {
  return labTestSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit") || undefined,
    normalRange: formData.get("normalRange") || undefined,
    price: formData.get("price"),
    category: formData.get("category") || undefined,
    requiresExternalLab: formData.get("requiresExternalLab") ? "on" : "off",
  });
}

export async function createLabTest(
  _prevState: LabTestFormState,
  formData: FormData
): Promise<LabTestFormState> {
  await requireRole(STAFF_ROLES);

  const parsed = parseLabTestForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.labTest.create({ data: parsed.data });

  revalidatePath("/staff/lab");
  return { success: true };
}

// Lets staff re-link a test to a different category (e.g. fixing a bad
// auto-categorization, or categorizing a newly added test) — see
// src/lib/lab-categories.ts for the fixed category list this validates
// against. Name/unit/normalRange/price stay editable too since this is the
// only edit path LabTest has.
export async function updateLabTest(
  labTestId: string,
  _prevState: LabTestFormState,
  formData: FormData
): Promise<LabTestFormState> {
  await requireRole(STAFF_ROLES);

  const parsed = parseLabTestForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.labTest.update({ where: { id: labTestId }, data: parsed.data });

  revalidatePath("/staff/lab");
  return { success: true };
}

// LabOrderItem.labTestId has no onDelete rule (defaults to RESTRICT at the
// DB level), so deleting a test with order history would otherwise throw a
// raw FK-violation error — check first and give a real message, same as
// deleteClinicService. A linked ClinicService (SetNull on delete) would
// silently lose its price sync instead of erroring, so block that too and
// point staff at unlinking/deleting the service first.
/* eslint-disable @typescript-eslint/no-unused-vars -- signature must match useActionState's (state, formData) */
export async function deleteLabTest(
  labTestId: string,
  _prevState: LabTestFormState,
  _formData: FormData
): Promise<LabTestFormState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  await requireRole(STAFF_ROLES);

  const [orderItemCount, referralItemCount, linkedService] = await Promise.all([
    prisma.labOrderItem.count({ where: { labTestId } }),
    prisma.externalLabReferralItem.count({ where: { labTestId } }),
    prisma.clinicService.findUnique({ where: { labTestId } }),
  ]);
  if (orderItemCount > 0) {
    return {
      error: `Can't delete — ordered ${orderItemCount} time${orderItemCount === 1 ? "" : "s"} already. Existing lab orders need this record to keep their results.`,
    };
  }
  if (referralItemCount > 0) {
    return {
      error: `Can't delete — referred to an external lab ${referralItemCount} time${referralItemCount === 1 ? "" : "s"} already.`,
    };
  }
  if (linkedService) {
    return {
      error: `Can't delete — linked to the clinic service "${linkedService.name}". Unlink or delete that service first.`,
    };
  }

  await prisma.labTest.delete({ where: { id: labTestId } });

  revalidatePath("/staff/lab");
  return { success: true };
}

const orderTestsSchema = z.object({
  testIds: z.array(z.string().min(1)).min(1),
});

export type OrderLabTestsState = { error?: string; success?: boolean };

export async function orderLabTests(
  appointmentId: string,
  _prevState: OrderLabTestsState,
  formData: FormData
): Promise<OrderLabTestsState> {
  const session = await requireRole(["DOCTOR"]);

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment || appointment.doctorId !== session.user.doctorId) {
    throw new UnauthorizedError("Not your appointment");
  }

  const parsed = orderTestsSchema.safeParse({
    testIds: formData.getAll("testIds"),
  });
  if (!parsed.success) {
    return { error: "Select at least one test" };
  }

  const tests = await prisma.labTest.findMany({
    where: { id: { in: parsed.data.testIds } },
  });
  if (tests.length === 0) {
    return { error: "Select at least one test" };
  }

  await prisma.labOrder.create({
    data: {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentId,
      items: {
        create: tests.map((test) => ({
          labTestId: test.id,
          price: test.price,
        })),
      },
    },
  });

  await ensureConsultationFeeBilled(appointmentId);
  await billLabTestsToInvoice(appointment.patientId, appointmentId, tests);

  revalidatePath(`/doctor/appointments/${appointmentId}`);
  revalidatePath("/staff/lab");
  revalidatePath("/staff/billing");
  revalidatePath("/portal/invoices");
  return { success: true };
}

const staffOrderSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  testIds: z.array(z.string().min(1)).min(1),
  appointmentId: z.string().optional(),
});

export type StaffOrderLabTestsState = { error?: string; success?: boolean; orderId?: string };

export async function orderLabTestsByStaff(
  _prevState: StaffOrderLabTestsState,
  formData: FormData
): Promise<StaffOrderLabTestsState> {
  await requireRole(STAFF_ROLES);

  const parsed = staffOrderSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId"),
    testIds: formData.getAll("testIds"),
    appointmentId: formData.get("appointmentId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Select a patient, doctor, and at least one test" };
  }

  const tests = await prisma.labTest.findMany({
    where: { id: { in: parsed.data.testIds } },
  });
  if (tests.length === 0) {
    return { error: "Select at least one test" };
  }

  const order = await prisma.labOrder.create({
    data: {
      patientId: parsed.data.patientId,
      doctorId: parsed.data.doctorId,
      appointmentId: parsed.data.appointmentId,
      items: {
        create: tests.map((test) => ({
          labTestId: test.id,
          price: test.price,
        })),
      },
    },
  });

  if (parsed.data.appointmentId) {
    await ensureConsultationFeeBilled(parsed.data.appointmentId);
  }
  await billLabTestsToInvoice(parsed.data.patientId, parsed.data.appointmentId, tests);

  revalidatePath("/staff/lab");
  revalidatePath("/staff/billing");
  revalidatePath("/portal/invoices");
  // Set (from the "Lab Visit" appointment detail page's inline order form)
  // when this order fulfills a category-level Lab Visit booking — without
  // this, the appointment's "needs a lab order" prompt would never clear
  // since it keys off appointment.labOrders.
  if (parsed.data.appointmentId) {
    revalidatePath(`/staff/appointments/${parsed.data.appointmentId}`);
  }
  return { success: true, orderId: order.id };
}

export async function collectSample(labOrderId: string) {
  await requireRole(STAFF_ROLES);

  await prisma.labOrder.update({
    where: { id: labOrderId },
    data: { status: "SAMPLE_COLLECTED", sampleCollectedAt: new Date() },
  });

  revalidatePath("/staff/lab");
  revalidatePath(`/staff/lab/${labOrderId}`);
}

export type EnterResultsState = { error?: string; success?: boolean };

export async function enterResults(
  labOrderId: string,
  _prevState: EnterResultsState,
  formData: FormData
): Promise<EnterResultsState> {
  await requireRole(STAFF_ROLES);

  const order = await prisma.labOrder.findUnique({
    where: { id: labOrderId },
    include: {
      items: { include: { labTest: true } },
      patient: true,
      doctor: { include: { user: true } },
    },
  });
  if (!order) {
    return { error: "Lab order not found" };
  }
  if (order.status !== "SAMPLE_COLLECTED") {
    return { error: "Collect the sample before entering results" };
  }

  const validStatuses = new Set(["NORMAL", "BORDERLINE", "LOW", "HIGH"]);
  for (const item of order.items) {
    const value = formData.get(`result-${item.id}`);
    const note = formData.get(`note-${item.id}`);
    const status = formData.get(`status-${item.id}`);
    await prisma.labOrderItem.update({
      where: { id: item.id },
      data: {
        resultValue: typeof value === "string" && value ? value : null,
        resultNote: typeof note === "string" && note ? note : null,
        resultStatus:
          typeof status === "string" && validStatuses.has(status)
            ? (status as "NORMAL" | "BORDERLINE" | "LOW" | "HIGH")
            : null,
        resultEnteredAt: new Date(),
      },
    });
  }

  await prisma.labOrder.update({
    where: { id: labOrderId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await notifyStaff(
    `🧪 Lab results ready for ${order.patient.name} — ordered by ${order.doctor.user.name}.`
  );
  await notifyPatient(
    order.patientId,
    `🧪 Your lab results are ready. Please check your patient portal or contact the clinic.`
  );
  const testNames = order.items.map((i) => i.labTest.name).join(", ");
  await createNotification({
    patientId: order.patientId,
    category: "LAB_RESULT",
    tone: "SUCCESS",
    title: "Lab Results Ready",
    body: `Your ${testNames} results are now available. View in Medical Records.`,
    href: "/portal/medical-records",
    relatedId: `lab-${order.id}`,
  });
  if (order.doctor.notifyLabResults) {
    await notifyStaffUsers({
      userIds: [order.doctor.userId],
      category: "LAB_RESULT",
      tone: "SUCCESS",
      title: "Lab Results Ready",
      body: `${testNames} results for ${order.patient.name} are ready to review.`,
      href: `/doctor/patients/${order.patientId}`,
      relatedId: `lab-${order.id}`,
    });
    await notifyDoctor(order.doctorId, `🧪 ${testNames} results for ${order.patient.name} are ready to review.`);
  }

  revalidatePath("/staff/lab");
  revalidatePath(`/staff/lab/${labOrderId}`);
  revalidatePath("/portal/medical-records");
  revalidatePath("/portal/notifications");
  return { success: true };
}
