import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Laboratory workflow", () => {
  let appointmentId: string;
  let patientId: string;
  let doctorId: string;

  test.beforeEach(async () => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    doctorId = doctor.id;

    await prisma.labTest.upsert({
      where: { id: "seed-labtest-cbc" },
      update: {},
      create: {
        id: "seed-labtest-cbc",
        name: "Complete Blood Count (CBC)",
        unit: "cells/mcL",
        normalRange: "4,500–11,000",
        price: 150,
      },
    });

    // Use the real seeded patient (not a throwaway one), since the last assertion
    // in the test below logs in as that account to check its own report.
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
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
    const orders = await prisma.labOrder.findMany({ where: { appointmentId } });
    for (const order of orders) {
      await prisma.labOrderItem.deleteMany({ where: { labOrderId: order.id } });
      await prisma.labOrder.delete({ where: { id: order.id } });
    }
    await prisma.appointment.delete({ where: { id: appointmentId } });
  });

  test("a doctor orders a test, the lab collects the sample, enters results, and the patient can view the report", async ({
    page,
  }) => {
    // Doctor orders the test from the appointment.
    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/appointments/${appointmentId}`);
    await page.check('input[name="testIds"]');
    await page.click('button:has-text("Order tests")');
    await page.waitForLoadState("networkidle");

    const order = await prisma.labOrder.findFirstOrThrow({ where: { appointmentId } });
    expect(order.status).toBe("ORDERED");

    // Lab tech collects the sample.
    await loginAs(page, "lab@nca.clinic");
    await page.goto("/en/staff/lab");
    await page.click('button:has-text("Collect sample")');
    await page.waitForLoadState("networkidle");

    const collected = await prisma.labOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(collected.status).toBe("SAMPLE_COLLECTED");
    expect(collected.sampleCollectedAt).not.toBeNull();

    // Lab tech enters results, completing the order.
    await page.goto(`/en/staff/lab/${order.id}`);
    await page.locator('input[id^="result-"]').first().fill("7,200");
    await page.click('button:has-text("Save results")');
    await page.waitForLoadState("networkidle");

    const completed = await prisma.labOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.items[0].resultValue).toBe("7,200");

    // The report is reachable and shows the result.
    await page.goto(`/en/lab-report/${order.id}`);
    await expect(page.getByText("7,200")).toBeVisible();

    // The patient can view their own completed result.
    await loginAs(page, "patient@example.com");
    const response = await page.goto(`/en/lab-report/${order.id}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByText("7,200")).toBeVisible();
  });
});
