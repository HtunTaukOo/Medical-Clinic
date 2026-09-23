import { test, expect } from "@playwright/test";
import { loginAs, logout } from "./helpers";
import { prisma } from "./db";

async function setupRxAppointment(label: string) {
  const doctor = await prisma.doctorProfile.findFirstOrThrow({ where: { user: { email: "doctor@nca.clinic" } } });
  const medicine = await prisma.medicine.findFirstOrThrow({ where: { name: { contains: "Paracetamol" } } });
  const patient = await prisma.patient.create({ data: { name: `Pharmacy Dispense Test ${label} ${Date.now()}` } });
  const appointment = await prisma.appointment.create({
    data: { doctorId: doctor.id, patientId: patient.id, scheduledAt: new Date(), status: "CHECKED_IN", checkedInAt: new Date() },
  });
  return { doctor, medicine, patient, appointment };
}

async function cleanup(appointmentId: string, patientId: string) {
  const invoices = await prisma.invoice.findMany({ where: { patientId } });
  for (const inv of invoices) {
    await prisma.payment.deleteMany({ where: { invoiceId: inv.id } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
    await prisma.invoice.delete({ where: { id: inv.id } });
  }
  const sales = await prisma.pharmacySale.findMany({ where: { patientId } });
  for (const sale of sales) {
    await prisma.pharmacySaleItem.deleteMany({ where: { saleId: sale.id } });
    await prisma.pharmacySale.delete({ where: { id: sale.id } });
  }
  const prescriptions = await prisma.prescription.findMany({ where: { appointmentId }, include: { items: true } });
  for (const rx of prescriptions) {
    for (const item of rx.items) {
      await prisma.pillReminder.deleteMany({ where: { prescriptionItemId: item.id } });
    }
    await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: rx.id } });
  }
  await prisma.prescription.deleteMany({ where: { appointmentId } });
  await prisma.stockTransaction.deleteMany({ where: { reason: { contains: appointmentId } } });
  await prisma.appointment.delete({ where: { id: appointmentId } });
  await prisma.patient.delete({ where: { id: patientId } });
}

test("dispensing a pure prescription creates no new sale or invoice", async ({ page }) => {
  const { medicine, patient, appointment } = await setupRxAppointment("Pure");

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Prescribe" }).click();
  const rxForm = page.locator("form").filter({ has: page.locator('input[placeholder="Dosage"]') });
  await rxForm.locator('button[role="combobox"]').first().click();
  await page.click('[role="option"]:has-text("Paracetamol")');
  await page.fill('input[placeholder="Dosage"]', "1 tablet");
  await rxForm.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Pending|Fulfilled/)).toBeVisible();

  const rx = await prisma.prescription.findFirstOrThrow({ where: { appointmentId: appointment.id } });
  const invoiceBefore = await prisma.invoice.findMany({ where: { patientId: patient.id } });
  expect(invoiceBefore).toHaveLength(1);

  await logout(page);
  await loginAs(page, "admin@nca.clinic");
  await page.goto("/en/staff/pharmacy?tab=prescriptions");
  const rxCard = page.locator('[data-slot="card"]', { hasText: patient.name });
  await rxCard.getByRole("link", { name: "Dispense" }).click();

  await expect(page.getByText("Prescribed (already invoiced)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dispense Prescription" })).toBeVisible();
  await page.getByRole("button", { name: "Dispense Prescription" }).click();
  await expect(page.getByText("Prescription dispensed.")).toBeVisible();

  const rxAfter = await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } });
  expect(rxAfter.fulfilled).toBe(true);

  const sales = await prisma.pharmacySale.findMany({ where: { prescriptionId: rx.id } });
  expect(sales).toHaveLength(0);

  const invoicesAfter = await prisma.invoice.findMany({ where: { patientId: patient.id } });
  expect(invoicesAfter).toHaveLength(1); // still just the original appointment invoice

  const stockTx = await prisma.stockTransaction.findFirst({
    where: { medicineId: medicine.id, reason: "Prescription dispensed" },
    orderBy: { createdAt: "desc" },
  });
  expect(stockTx).not.toBeNull();

  await cleanup(appointment.id, patient.id);
});

test("adding an OTC item alongside a prescription only bills the OTC item", async ({ page }) => {
  const { patient, appointment } = await setupRxAppointment("Mixed");
  const otcMedicine = await prisma.medicine.findFirstOrThrow({
    where: { name: { contains: "Ibuprofen" } },
  });

  await loginAs(page, "doctor@nca.clinic");
  await page.goto(`/en/doctor/appointments/${appointment.id}`);
  await page.getByRole("button", { name: "Start Consultation" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Prescribe" }).click();
  const rxForm = page.locator("form").filter({ has: page.locator('input[placeholder="Dosage"]') });
  await rxForm.locator('button[role="combobox"]').first().click();
  await page.click('[role="option"]:has-text("Paracetamol")');
  await page.fill('input[placeholder="Dosage"]', "1 tablet");
  await rxForm.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Pending|Fulfilled/)).toBeVisible();

  const rx = await prisma.prescription.findFirstOrThrow({ where: { appointmentId: appointment.id } });

  await logout(page);
  await loginAs(page, "admin@nca.clinic");
  await page.goto("/en/staff/pharmacy?tab=prescriptions");
  await page.locator('[data-slot="card"]', { hasText: patient.name }).getByRole("link", { name: "Dispense" }).click();

  await page.getByPlaceholder("Search medicine to add...").fill("Ibuprofen");
  await page.getByText(otcMedicine.name, { exact: false }).first().click();

  await expect(page.getByRole("button", { name: "Complete Sale" })).toBeVisible();
  await page.getByRole("button", { name: "Complete Sale" }).click();
  await expect(page.getByText("Sale completed successfully.")).toBeVisible();

  const sale = await prisma.pharmacySale.findFirstOrThrow({ where: { prescriptionId: rx.id } });
  const saleItems = await prisma.pharmacySaleItem.findMany({ where: { saleId: sale.id } });
  expect(saleItems).toHaveLength(1);
  expect(saleItems[0].medicineId).toBe(otcMedicine.id);
  expect(Number(sale.total)).toBe(Number(otcMedicine.price));

  const rxAfter = await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } });
  expect(rxAfter.fulfilled).toBe(true);

  await cleanup(appointment.id, patient.id);
});
