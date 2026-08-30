import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Allergies, insurance, and emergency contact fields", () => {
  test("a patient can save personal/insurance/emergency contact fields and add their own allergy", async ({
    page,
  }) => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto("/en/portal/settings");

      // Personal Details tab (default) — gender + a couple of new demographic fields.
      await page.locator("#gender").click();
      await page.getByRole("option", { name: "Female" }).click();
      await page.fill("#nationality", "Myanmar");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();

      // Insurance tab has its own save action.
      await page.getByRole("tab", { name: "Insurance" }).click();
      await page.fill("#insuranceProvider", "Grand Guardian");
      await page.fill("#insurancePolicyNumber", "GG-12345");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();

      // Emergency Contact tab has its own save action.
      await page.getByRole("tab", { name: "Emergency Contact" }).click();
      await page.fill("#emergencyContactName", "Aunt May");
      await page.fill("#emergencyContactPhone", "09-123456789");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();

      const updated = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
      expect(updated.gender).toBe("FEMALE");
      expect(updated.nationality).toBe("Myanmar");
      expect(updated.insuranceProvider).toBe("Grand Guardian");
      expect(updated.insurancePolicyNumber).toBe("GG-12345");
      expect(updated.emergencyContactName).toBe("Aunt May");
      expect(updated.emergencyContactPhone).toBe("09-123456789");

      await page.reload();
      await expect(page.locator("#gender")).toContainText("Female");
      await page.getByRole("tab", { name: "Insurance" }).click();
      await expect(page.locator("#insuranceProvider")).toHaveValue("Grand Guardian");

      await page.getByRole("tab", { name: "Personal Details" }).click();
      await page.fill("#allergy-name", "Penicillin");
      await page.fill("#allergy-reaction", "Hives");
      await page.click('button:has-text("Add allergy")');
      await expect(page.getByText("Penicillin")).toBeVisible();

      const allergy = await prisma.allergy.findFirstOrThrow({
        where: { patientId: patient.id, name: "Penicillin" },
      });
      expect(allergy.reaction).toBe("Hives");
    } finally {
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          gender: null,
          nationality: null,
          insuranceProvider: null,
          insurancePolicyNumber: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
        },
      });
      await prisma.allergy.deleteMany({ where: { patientId: patient.id } });
    }
  });

  test("a doctor sees a patient's full profile read-only (not just name/phone/email)", async ({
    page,
  }) => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const original = { dob: patient.dob, notes: patient.notes };
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        gender: "FEMALE",
        emergencyContactName: "John Doe",
        dob: new Date("1990-05-15"),
        notes: "History of asthma",
      },
    });
    const allergy = await prisma.allergy.create({
      data: { patientId: patient.id, name: "Latex", category: "OTHER", severity: "MODERATE" },
    });

    try {
      await loginAs(page, "doctor@nca.clinic");
      await page.goto(`/en/staff/patients/${patient.id}`);

      await expect(page.getByText("Female", { exact: true })).toBeVisible();
      await expect(page.getByText("Latex")).toBeVisible();
      await expect(page.getByText(/Emergency contact:/)).toBeVisible();
      await expect(page.getByText(/Medical notes:/)).toBeVisible();
      await expect(page.getByText("History of asthma")).toBeVisible();
      await expect(page.getByText("5/15/1990")).toBeVisible();
      await expect(page.locator("#allergies")).toHaveCount(0);
    } finally {
      await prisma.allergy.delete({ where: { id: allergy.id } });
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          gender: null,
          emergencyContactName: null,
          dob: original.dob,
          notes: original.notes,
        },
      });
    }
  });
});
