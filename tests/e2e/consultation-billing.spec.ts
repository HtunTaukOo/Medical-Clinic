import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

async function setupCheckedInVisit(label: string, consultationFee: number) {
  const doctor = await prisma.doctorProfile.findFirstOrThrow({ where: { user: { email: "doctor@nca.clinic" } } });
  const originalFee = doctor.consultationFee;
  await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { consultationFee } });

  const patient = await prisma.patient.create({ data: { name: `Consult Billing ${label} ${Date.now()}` } });
  const appointment = await prisma.appointment.create({
    data: { doctorId: doctor.id, patientId: patient.id, scheduledAt: new Date(), status: "CHECKED_IN", checkedInAt: new Date() },
  });
  return { doctor, originalFee, patient, appointment };
}

async function cleanup(appointmentId: string, patientId: string, doctorId: string, originalFee: unknown) {
  const invoices = await prisma.invoice.findMany({ where: { appointmentId } });
  for (const inv of invoices) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
    await prisma.invoice.delete({ where: { id: inv.id } });
  }
  await prisma.pillReminder.deleteMany({ where: { patientId } });
  await prisma.prescriptionItem.deleteMany({ where: { prescription: { appointmentId } } });
  await prisma.prescription.deleteMany({ where: { appointmentId } });
  await prisma.labOrderItem.deleteMany({ where: { labOrder: { appointmentId } } });
  await prisma.labOrder.deleteMany({ where: { appointmentId } });
  await prisma.appointment.delete({ where: { id: appointmentId } });
  await prisma.patient.delete({ where: { id: patientId } });
  await prisma.doctorProfile.update({ where: { id: doctorId }, data: { consultationFee: originalFee as never } });
}

test("a consultation-only visit (no prescription, no lab) still bills the consultation fee", async ({ page }) => {
  const { doctor, originalFee, patient, appointment } = await setupCheckedInVisit("Solo", 3000);

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { appointmentId: appointment.id },
    include: { items: true },
  });
  expect(invoice.items).toHaveLength(1);
  expect(invoice.items[0].description.startsWith("Consultation —")).toBe(true);
  expect(Number(invoice.total)).toBe(3000);

  await cleanup(appointment.id, patient.id, doctor.id, originalFee);
});

test("ordering a lab test (no prescription) then completing the visit bills both the test and the consultation fee, not duplicated", async ({ page }) => {
  const { doctor, originalFee, patient, appointment } = await setupCheckedInVisit("LabThenComplete", 2500);

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Request Lab" }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Order tests" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const invoices = await prisma.invoice.findMany({
    where: { appointmentId: appointment.id },
    include: { items: true },
  });
  expect(invoices).toHaveLength(1);
  const items = invoices[0].items;
  expect(items.filter((i) => i.description.startsWith("Consultation —"))).toHaveLength(1);
  expect(items.filter((i) => i.description.startsWith("Lab Test —"))).toHaveLength(1);
  expect(Number(invoices[0].total)).toBe(2500 + Number(items.find((i) => i.description.startsWith("Lab Test —"))!.unitPrice));

  await cleanup(appointment.id, patient.id, doctor.id, originalFee);
});

test("lab test then prescription in the same visit bills consultation fee, lab test, and medicine exactly once each", async ({ page }) => {
  const { doctor, originalFee, patient, appointment } = await setupCheckedInVisit("LabThenRx", 4000);
  const medicine = await prisma.medicine.findFirstOrThrow({ where: { name: { contains: "Paracetamol" } } });

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Request Lab" }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Order tests" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Prescribe" }).click();
  const rxForm = page.locator("form").filter({ has: page.locator('input[placeholder="Dosage"]') });
  await rxForm.locator('button[role="combobox"]').first().click();
  await page.click('[role="option"]:has-text("Paracetamol")');
  await page.fill('input[placeholder="Dosage"]', "1 tablet");
  await rxForm.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const invoices = await prisma.invoice.findMany({
    where: { appointmentId: appointment.id },
    include: { items: true },
  });
  expect(invoices).toHaveLength(1);
  const items = invoices[0].items;
  expect(items.filter((i) => i.description.startsWith("Consultation —"))).toHaveLength(1);
  expect(items.filter((i) => i.description.startsWith("Lab Test —"))).toHaveLength(1);
  expect(items.some((i) => i.description.includes(medicine.name.split(" ")[0]))).toBe(true);

  const expectedTotal = items.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
  expect(Number(invoices[0].total)).toBe(expectedTotal);
  expect(Number(invoices[0].total)).toBeGreaterThanOrEqual(4000);

  await cleanup(appointment.id, patient.id, doctor.id, originalFee);
});
