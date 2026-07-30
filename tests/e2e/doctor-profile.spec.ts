import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Patient-facing doctor profile", () => {
  test("a patient can view a doctor's profile from Find Doctors", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });

    await loginAs(page, "patient@example.com");
    await page.goto("/en/portal/doctors");
    await page.click(`a[href="/en/portal/doctors/${doctor.id}"]:has-text("View profile")`);

    await expect(page.getByRole("heading", { name: doctor.user.name })).toBeVisible();
    await expect(page.getByText(/Consultation fee:/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Request appointment" })).toHaveAttribute(
      "href",
      `/en/portal/appointments/new?doctorId=${doctor.id}`
    );
  });

  test("visiting a non-existent doctor profile 404s", async ({ page }) => {
    await loginAs(page, "patient@example.com");
    const response = await page.goto("/en/portal/doctors/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
