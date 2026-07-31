import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Structured diagnosis", () => {
  let appointmentId: string;

  test.beforeEach(async () => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
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
  });

  test.afterEach(async () => {
    await prisma.diagnosis.deleteMany({ where: { appointmentId } });
    await prisma.appointment.delete({ where: { id: appointmentId } });
  });

  test("a doctor can record a diagnosis from the quick-pick list and it shows for the patient", async ({
    page,
  }) => {
    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/appointments/${appointmentId}`);

    await page.locator("#diagnosis-quickpick").click();
    await page.getByRole("option", { name: /J00 — Acute nasopharyngitis/ }).click();
    await page.fill("#diagnosis-notes", "Advised rest and fluids");
    await page.click('button:has-text("Add diagnosis")');
    await page.waitForLoadState("networkidle");

    const saved = await prisma.diagnosis.findFirstOrThrow({ where: { appointmentId } });
    expect(saved.code).toBe("J00");
    expect(saved.description).toContain("Acute nasopharyngitis");
    expect(saved.notes).toBe("Advised rest and fluids");

    await expect(page.getByText("J00").first()).toBeVisible();
    await expect(page.getByText(/Acute nasopharyngitis/).first()).toBeVisible();

    await loginAs(page, "patient@example.com");
    await page.goto(`/en/portal/appointments/${appointmentId}`);
    await expect(page.getByText("J00").first()).toBeVisible();
    await expect(page.getByText(/Acute nasopharyngitis/).first()).toBeVisible();
  });

  test("a doctor can record a fully custom diagnosis not on the preset list", async ({ page }) => {
    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/appointments/${appointmentId}`);

    await page.fill("#diagnosis-code", "Z99.9");
    await page.fill("#diagnosis-description", "A custom test condition");
    await page.click('button:has-text("Add diagnosis")');
    await page.waitForLoadState("networkidle");

    const saved = await prisma.diagnosis.findFirstOrThrow({ where: { appointmentId } });
    expect(saved.code).toBe("Z99.9");
    expect(saved.description).toBe("A custom test condition");

    await expect(page.getByText("A custom test condition")).toBeVisible();
  });

  test("a doctor can remove a diagnosis they recorded", async ({ page }) => {
    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/appointments/${appointmentId}`);

    await page.fill("#diagnosis-description", "Temporary diagnosis to remove");
    await page.click('button:has-text("Add diagnosis")');
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Temporary diagnosis to remove")).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Temporary diagnosis to remove")).not.toBeVisible();

    const count = await prisma.diagnosis.count({ where: { appointmentId } });
    expect(count).toBe(0);
  });

  test("diagnosis history shows on the patient's staff profile page", async ({ page }) => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    await prisma.diagnosis.create({
      data: {
        appointmentId,
        patientId: patient.id,
        doctorId: doctor.id,
        code: "I10",
        description: "Essential (primary) hypertension",
      },
    });

    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/patients/${patient.id}`);

    await expect(page.getByText("Diagnosis History")).toBeVisible();
    await expect(page.getByText("I10")).toBeVisible();
    await expect(page.getByText("Essential (primary) hypertension")).toBeVisible();
  });
});
