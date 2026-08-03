import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// Only /staff/users is special-cased in proxy.ts (redirects non-admins at
// the edge, before any page even renders). Every other role-gated staff page
// relies solely on requirePageRole() inside the Server Component itself —
// this file checks that path specifically, across a few different pages and
// roles, rather than trusting a single spot check.
test.describe("Role-gated page redirects (not raw error pages)", () => {
  test("a receptionist visiting an admin-only page is redirected, not shown a server error", async ({
    page,
  }) => {
    await loginAs(page, "receptionist@nca.clinic");
    const response = await page.goto("/en/staff/reports");
    expect(response?.status()).toBe(200);
    expect(page.url()).not.toContain("/staff/reports");
  });

  test("a lab tech visiting a billing-only page is redirected to the staff dashboard", async ({
    page,
  }) => {
    await loginAs(page, "lab@nca.clinic");
    const response = await page.goto("/en/staff/billing");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/en/staff");
    expect(page.url()).not.toContain("/staff/billing");
  });

  test("a pharmacist visiting a doctor-only page is redirected", async ({ page }) => {
    await loginAs(page, "pharmacist@nca.clinic");
    const response = await page.goto("/en/staff/my-availability");
    expect(response?.status()).toBe(200);
    expect(page.url()).not.toContain("/my-availability");
  });
});
