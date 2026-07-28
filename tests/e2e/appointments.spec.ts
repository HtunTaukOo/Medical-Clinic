import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("No-show", () => {
  let appointmentId: string;
  let patientName: string;

  test.beforeEach(async () => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    patientName = patient.name;

    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt: new Date(),
        status: "CONFIRMED",
      },
    });
    appointmentId = appointment.id;
  });

  test.afterEach(async () => {
    await prisma.appointment.delete({ where: { id: appointmentId } });
  });

  test("marking a confirmed appointment as no-show removes it from the queue and locks further status changes", async ({
    page,
  }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto("/en/staff/queue");
    await expect(page.getByText(patientName).first()).toBeVisible();

    await page.getByRole("button", { name: "No-show" }).first().click();
    await page.waitForLoadState("networkidle");

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
    });
    expect(updated.status).toBe("NO_SHOW");

    await page.goto("/en/staff/queue");
    await expect(page.getByText(patientName)).toHaveCount(0);

    await page.goto(`/en/staff/appointments/${appointmentId}`);
    await expect(page.getByText("NO_SHOW")).toBeVisible();
    await expect(page.getByRole("button", { name: "No-show" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Check in" })).toHaveCount(0);
  });
});

test.describe("Patient self-cancel", () => {
  let appointmentId: string;

  test.afterEach(async () => {
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
  });

  test("a patient can cancel their own confirmed appointment from the portal", async ({
    page,
  }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });

    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "CONFIRMED",
      },
    });
    appointmentId = appointment.id;

    await loginAs(page, "patient@example.com");
    await page.goto(`/en/portal/appointments/${appointmentId}`);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForLoadState("networkidle");

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
    });
    expect(updated.status).toBe("CANCELLED");
  });

  test("a patient cannot cancel a checked-in appointment (no cancel button offered)", async ({
    page,
  }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });

    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt: new Date(),
        status: "CHECKED_IN",
        checkedInAt: new Date(),
      },
    });
    appointmentId = appointment.id;

    await loginAs(page, "patient@example.com");
    await page.goto(`/en/portal/appointments/${appointmentId}`);
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    const unchanged = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
    });
    expect(unchanged.status).toBe("CHECKED_IN");
  });
});
