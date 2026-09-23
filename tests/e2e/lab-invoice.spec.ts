import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test("doctor's Request Lab bills the test onto the appointment invoice", async ({ page }) => {
  const doctor = await prisma.doctorProfile.findFirstOrThrow({ where: { user: { email: "doctor@nca.clinic" } } });
  const originalFee = doctor.consultationFee;
  await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { consultationFee: 0 } });

  const patient = await prisma.patient.create({ data: { name: `Lab Invoice Test ${Date.now()}` } });
  const appointment = await prisma.appointment.create({
    data: { doctorId: doctor.id, patientId: patient.id, scheduledAt: new Date(), status: "CHECKED_IN", checkedInAt: new Date() },
  });

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Request Lab" }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Order tests" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const invoice = await prisma.invoice.findUnique({ where: { appointmentId: appointment.id }, include: { items: true } });
  expect(invoice).not.toBeNull();
  expect(invoice!.items.some((i) => i.description.startsWith("Lab Test —"))).toBe(true);

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice!.id } });
  await prisma.invoice.delete({ where: { id: invoice!.id } });
  await prisma.labOrderItem.deleteMany({ where: { labOrder: { appointmentId: appointment.id } } });
  await prisma.labOrder.deleteMany({ where: { appointmentId: appointment.id } });
  await prisma.appointment.delete({ where: { id: appointment.id } });
  await prisma.patient.delete({ where: { id: patient.id } });
  await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { consultationFee: originalFee } });
});

test("lab test ordered after a prescription merges into the same invoice, not a duplicate", async ({ page }) => {
  const doctor = await prisma.doctorProfile.findFirstOrThrow({ where: { user: { email: "doctor@nca.clinic" } } });
  const medicine = await prisma.medicine.findFirstOrThrow({ where: { name: { contains: "Paracetamol" } } });
  const originalFee = doctor.consultationFee;
  await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { consultationFee: 0 } });

  const patient = await prisma.patient.create({ data: { name: `Lab Merge Test ${Date.now()}` } });
  const appointment = await prisma.appointment.create({
    data: { doctorId: doctor.id, patientId: patient.id, scheduledAt: new Date(), status: "CHECKED_IN", checkedInAt: new Date() },
  });

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");

  // Write a prescription first — this already auto-creates an invoice.
  await page.getByRole("button", { name: "Prescribe" }).click();
  const rxForm = page.locator("form").filter({ has: page.locator('input[placeholder="Dosage"]') });
  await rxForm.locator('button[role="combobox"]').first().click();
  await page.click('[role="option"]:has-text("Paracetamol")');
  await page.fill('input[placeholder="Dosage"]', "1 tablet");
  await rxForm.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const invoiceAfterRx = await prisma.invoice.findUniqueOrThrow({ where: { appointmentId: appointment.id } });

  // Now order a lab test in the same visit.
  await page.getByRole("button", { name: "Request Lab" }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Order tests" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const invoices = await prisma.invoice.findMany({ where: { appointmentId: appointment.id }, include: { items: true } });
  expect(invoices).toHaveLength(1);
  expect(invoices[0].id).toBe(invoiceAfterRx.id);
  expect(invoices[0].items.some((i) => i.description.startsWith("Lab Test —"))).toBe(true);
  expect(invoices[0].items.some((i) => i.description.includes(medicine.name.split(" ")[0]))).toBe(true);

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoices[0].id } });
  await prisma.invoice.delete({ where: { id: invoices[0].id } });
  await prisma.pillReminder.deleteMany({ where: { patientId: patient.id } });
  await prisma.prescriptionItem.deleteMany({ where: { prescription: { appointmentId: appointment.id } } });
  await prisma.prescription.deleteMany({ where: { appointmentId: appointment.id } });
  await prisma.labOrderItem.deleteMany({ where: { labOrder: { appointmentId: appointment.id } } });
  await prisma.labOrder.deleteMany({ where: { appointmentId: appointment.id } });
  await prisma.appointment.delete({ where: { id: appointment.id } });
  await prisma.patient.delete({ where: { id: patient.id } });
  await prisma.doctorProfile.update({ where: { id: doctor.id }, data: { consultationFee: originalFee } });
});

test("staff standalone lab order (no appointment) creates its own invoice, attributed to Lab Visit Scheduling", async ({ page }) => {
  const labVisitDoctor = await prisma.doctorProfile.findFirstOrThrow({ where: { specialty: "Lab Visit" } });
  const patient = await prisma.patient.create({ data: { name: `Lab Standalone Test ${Date.now()}` } });

  await loginAs(page, "admin@nca.clinic");
  await page.goto("/en/staff/lab?tab=new");

  await expect(page.getByText("Referring Doctor")).toHaveCount(0);

  await page.getByPlaceholder("Search patient...").fill(patient.name);
  await page.getByRole("button", { name: patient.name }).click();

  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Create Order" }).click();
  await page.waitForLoadState("networkidle");

  const order = await prisma.labOrder.findFirstOrThrow({ where: { patientId: patient.id } });
  expect(order.doctorId).toBe(labVisitDoctor.id);

  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { patientId: patient.id },
    include: { items: true },
  });
  expect(invoice.appointmentId).toBeNull();
  expect(invoice.items.some((i) => i.description.startsWith("Lab Test —"))).toBe(true);

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await prisma.labOrderItem.deleteMany({ where: { labOrder: { patientId: patient.id } } });
  await prisma.labOrder.deleteMany({ where: { patientId: patient.id } });
  await prisma.patient.delete({ where: { id: patient.id } });
});
