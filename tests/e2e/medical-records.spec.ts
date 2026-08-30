import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Patient medical record self-removal", () => {
  test("a patient can remove their own record but not one added by the clinic", async ({
    page,
  }) => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const patientUser = await prisma.user.findFirstOrThrow({
      where: { patient: { id: patient.id } },
    });
    const doctorUser = await prisma.user.findFirstOrThrow({
      where: { email: "doctor@nca.clinic" },
    });

    const ownRecord = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        authorId: patientUser.id,
        type: "NOTE",
        note: "My own self-added note",
      },
    });
    const clinicRecord = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        authorId: doctorUser.id,
        type: "NOTE",
        note: "Clinic-authored note",
      },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto("/en/portal/medical-records");
      await page.getByRole("tab", { name: "Documents" }).click();

      await expect(page.getByText("My own self-added note")).toBeVisible();
      await expect(page.getByText("Clinic-authored note")).toBeVisible();

      // Only the self-authored record's row should offer a Remove button.
      // Scope to the row div specifically (its distinguishing class), since a
      // plain hasText div-filter would also match ancestor containers.
      const ownRow = page.locator("div.rounded-lg", { hasText: "My own self-added note" });
      const clinicRow = page.locator("div.rounded-lg", { hasText: "Clinic-authored note" });
      await expect(ownRow.getByRole("button", { name: "Remove" })).toHaveCount(1);
      await expect(clinicRow.getByRole("button", { name: "Remove" })).toHaveCount(0);

      await ownRow.getByRole("button", { name: "Remove" }).click();
      await expect(page.getByText("My own self-added note")).not.toBeVisible();
      await expect(page.getByText("Clinic-authored note")).toBeVisible();

      await expect.poll(async () => {
        return prisma.medicalRecord.findUnique({ where: { id: ownRecord.id } });
      }).toBeNull();

      const clinicStillThere = await prisma.medicalRecord.findUnique({
        where: { id: clinicRecord.id },
      });
      expect(clinicStillThere).not.toBeNull();
    } finally {
      await prisma.medicalRecord.deleteMany({
        where: { id: { in: [ownRecord.id, clinicRecord.id] } },
      });
    }
  });
});
