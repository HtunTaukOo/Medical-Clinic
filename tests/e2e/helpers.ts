import type { Page } from "@playwright/test";

export const SEEDED_PASSWORD = "password123";

export async function loginAs(page: Page, email: string, password = SEEDED_PASSWORD) {
  await page.goto("/en/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/login")),
    page.click('button[type="submit"]'),
  ]);
}

export async function logout(page: Page) {
  await page.click('button:has-text("Sign out")');
  await page.waitForURL((url) => url.pathname.endsWith("/login"));
}
