import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Prescription → invoice + reminders", () => {
  let appointmentId: string;
  let patientId: string;
  let doctorId: string;
  let originalFee: unknown;
  let medicinePrice: number;

  test.beforeEach(async () => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    doctorId = doctor.id;
    originalFee = doctor.consultationFee;
    await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: { consultationFee: 200 },
    });

    const medicine = await prisma.medicine.findFirstOrThrow({
      where: { name: { contains: "Paracetamol" } },
    });
    medicinePrice = Number(medicine.price);

    const patient = await prisma.patient.create({
      data: { name: `Rx Test Patient ${Date.now()}` },
    });
    patientId = patient.id;

    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId,
        scheduledAt: new Date(),
        status: "CHECKED_IN",
        checkedInAt: new Date(),
      },
    });
    appointmentId = appointment.id;
  });

  test.afterEach(async () => {
    const invoice = await prisma.invoice.findUnique({ where: { appointmentId } });
    if (invoice) {
      await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoice.delete({ where: { id: invoice.id } });
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { appointmentId },
      include: { items: true },
    });
    for (const rx of prescriptions) {
      for (const item of rx.items) {
        await prisma.pillReminder.deleteMany({ where: { prescriptionItemId: item.id } });
      }
      await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: rx.id } });
    }
    await prisma.prescription.deleteMany({ where: { appointmentId } });

    await prisma.appointment.delete({ where: { id: appointmentId } });
    await prisma.patient.delete({ where: { id: patientId } });
    await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: { consultationFee: originalFee as never },
    });
  });

  test("writing a prescription auto-creates an invoice with the medicine and consultation fee", async ({
    page,
  }) => {
    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/appointments/${appointmentId}`);

    await page
      .locator("form", { hasText: "Write prescription" })
      .locator('button[role="combobox"]')
      .first()
      .click();
    await page.click('[role="option"]:has-text("Paracetamol")');
    await page.fill('input[placeholder="Dosage"]', "1 tablet");
    await page.click('button:has-text("Write prescription")');
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Pending|Fulfilled/)).toBeVisible();

    const invoice = await prisma.invoice.findUnique({
      where: { appointmentId },
      include: { items: true },
    });
    expect(invoice).not.toBeNull();
    expect(Number(invoice!.total)).toBe(200 + medicinePrice);
    expect(invoice!.items).toHaveLength(2);
    expect(invoice!.items.some((i) => i.description.startsWith("Consultation"))).toBe(true);
  });

  test("a dosing schedule generates pill reminders for the patient", async ({ page }) => {
    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/appointments/${appointmentId}`);

    await page
      .locator("form", { hasText: "Write prescription" })
      .locator('button[role="combobox"]')
      .first()
      .click();
    await page.click('[role="option"]:has-text("Paracetamol")');
    await page.fill('input[placeholder="Dosage"]', "1 tablet");
    await page.fill('input[type="number"][min="1"][max="8"]', "2");
    await page.fill('input[placeholder="e.g. 5"]', "3");
    await page.click('button:has-text("Write prescription")');
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Pending|Fulfilled/)).toBeVisible();

    const reminders = await prisma.pillReminder.findMany({ where: { patientId } });
    expect(reminders.length).toBeGreaterThan(0);
  });
});
