import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Patient-facing doctor info in the booking wizard", () => {
  test("a patient can see a doctor's name and specialty while booking", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });

    await loginAs(page, "patient@example.com");
    await page.goto("/en/portal/book");
    await page.getByRole("button", { name: new RegExp(doctor.specialty ?? "General Medicine") }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("button", { name: new RegExp(doctor.user.name) })).toBeVisible();
  });
});
