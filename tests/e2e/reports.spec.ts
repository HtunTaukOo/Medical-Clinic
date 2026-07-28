import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Reports", () => {
  test("admin can view the reports page and export a CSV", async ({ page }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/reports");

    await expect(page.getByText("No-show rate")).toBeVisible();
    await expect(page.getByText("No-shows by doctor")).toBeVisible();

    const response = await page.request.get("/api/reports/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    const body = await response.text();
    expect(body).toContain("Revenue by month");
    expect(body).toContain("No-shows by doctor");
  });

  test("a non-admin cannot export the CSV", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    const response = await page.request.get("/api/reports/export");
    expect(response.status()).toBe(401);
  });
});
