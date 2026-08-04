import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Reports", () => {
  test("admin can view the reports page and export a CSV", async ({ page }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/reports");

    await expect(page.getByText("No-show rate").first()).toBeVisible();
    await expect(page.getByText("No-shows by doctor")).toBeVisible();
    await expect(page.getByText("Doctor productivity")).toBeVisible();
    await expect(page.getByText("Patient age distribution")).toBeVisible();
    await expect(page.getByText("Patients by gender")).toBeVisible();
    await expect(page.getByText("New patients by month")).toBeVisible();

    const response = await page.request.get("/api/reports/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    const body = await response.text();
    expect(body).toContain("Revenue by month");
    expect(body).toContain("No-shows by doctor");
    expect(body).toContain("Doctor productivity");
    expect(body).toContain("Patient age distribution");
    expect(body).toContain("Patients by gender");
    expect(body).toContain("New patients by month");
  });

  test("a non-admin cannot export the CSV", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    const response = await page.request.get("/api/reports/export");
    expect(response.status()).toBe(401);
  });

  test("a patient's age buckets correctly from their date of birth", async ({ page }) => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 35);
    const patient = await prisma.patient.create({
      data: { name: `Age Bucket Test ${Date.now()}`, dob },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/reports");
    await expect(page.getByText("30–44", { exact: true })).toBeVisible();

    await prisma.patient.delete({ where: { id: patient.id } });
  });

  test("a patient's gender is reflected in the gender distribution", async ({ page }) => {
    const patient = await prisma.patient.create({
      data: { name: `Gender Report Test ${Date.now()}`, gender: "OTHER" },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/reports");
    await expect(page.getByText("Other", { exact: true })).toBeVisible();

    await prisma.patient.delete({ where: { id: patient.id } });
  });
});
