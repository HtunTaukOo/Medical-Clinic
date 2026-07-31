import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Allergies, insurance, and emergency contact fields", () => {
  test("a patient can save and see their own allergies/insurance/emergency contact", async ({
    page,
  }) => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto("/en/portal/settings");

      await page.fill("#allergies", "Penicillin");
      await page.fill("#insuranceProvider", "Grand Guardian");
      await page.fill("#insurancePolicyNumber", "GG-12345");
      await page.fill("#emergencyContactName", "Aunt May");
      await page.fill("#emergencyContactPhone", "09-123456789");
      await page.click('button:has-text("Save changes")');
      await expect(page.getByText("Saved.")).toBeVisible();

      const updated = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
      expect(updated.allergies).toBe("Penicillin");
      expect(updated.insuranceProvider).toBe("Grand Guardian");
      expect(updated.insurancePolicyNumber).toBe("GG-12345");
      expect(updated.emergencyContactName).toBe("Aunt May");
      expect(updated.emergencyContactPhone).toBe("09-123456789");

      await page.reload();
      await expect(page.locator("#allergies")).toHaveValue("Penicillin");
      await expect(page.locator("#insuranceProvider")).toHaveValue("Grand Guardian");
    } finally {
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          allergies: null,
          insuranceProvider: null,
          insurancePolicyNumber: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
        },
      });
    }
  });

  test("a doctor sees a patient's allergies read-only (cannot edit patient details)", async ({
    page,
  }) => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    await prisma.patient.update({
      where: { id: patient.id },
      data: { allergies: "Latex", emergencyContactName: "John Doe" },
    });

    try {
      await loginAs(page, "doctor@nca.clinic");
      await page.goto(`/en/staff/patients/${patient.id}`);

      await expect(page.getByText(/Allergies:/)).toBeVisible();
      await expect(page.getByText("Latex")).toBeVisible();
      await expect(page.getByText(/Emergency contact:/)).toBeVisible();
      await expect(page.locator("#allergies")).toHaveCount(0);
    } finally {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { allergies: null, emergencyContactName: null },
      });
    }
  });
});
