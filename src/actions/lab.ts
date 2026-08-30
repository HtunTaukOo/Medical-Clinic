"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, UnauthorizedError } from "@/lib/authz";
import { notifyStaff, notifyPatient } from "@/lib/telegram";
import { createNotification } from "@/lib/notifications";

const LAB_STAFF_ROLES = ["ADMIN", "LAB_TECH"] as const;

const labTestSchema = z.object({
  name: z.string().min(1),
  unit: z.string().optional(),
  normalRange: z.string().optional(),
  price: z.coerce.number().nonnegative(),
});

export type LabTestFormState = { error?: string; success?: boolean };

export async function createLabTest(
  _prevState: LabTestFormState,
  formData: FormData
): Promise<LabTestFormState> {
  await requireRole([...LAB_STAFF_ROLES]);

  const parsed = labTestSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit") || undefined,
    normalRange: formData.get("normalRange") || undefined,
    price: formData.get("price"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.labTest.create({ data: parsed.data });

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

  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/lab");
  return { success: true };
}

export async function collectSample(labOrderId: string) {
  await requireRole([...LAB_STAFF_ROLES]);

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
  await requireRole([...LAB_STAFF_ROLES]);

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

  revalidatePath("/staff/lab");
  revalidatePath(`/staff/lab/${labOrderId}`);
  revalidatePath("/portal/medical-records");
  revalidatePath("/portal/notifications");
  return { success: true };
}
