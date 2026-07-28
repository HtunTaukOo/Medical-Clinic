import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Authentication", () => {
  test("logs in with valid credentials", async ({ page }) => {
    await loginAs(page, "admin@nca.clinic");
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByText("NCA Admin")).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/en/login");
    await page.fill("#email", "admin@nca.clinic");
    await page.fill("#password", "the-wrong-password");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/error=CredentialsSignin/);
  });

  test("password reset works end to end and never reveals whether an email exists", async ({
    page,
  }) => {
    const email = "patient@example.com";
    const { passwordHash: originalHash } = await prisma.user.findUniqueOrThrow({
      where: { email },
    });

    try {
      // Requesting a reset for an email that doesn't exist gives the same generic message.
      await page.goto("/en/forgot-password");
      await page.fill("#email", "this-account-does-not-exist@example.com");
      await page.click('button:has-text("Send reset link")');
      await expect(page.getByText(/reset link has been sent/i)).toBeVisible();

      // Requesting a reset for a real email issues a real token.
      await page.goto("/en/forgot-password");
      await page.fill("#email", email);
      await page.click('button:has-text("Send reset link")');
      await expect(page.getByText(/reset link has been sent/i)).toBeVisible();

      const { resetToken, resetTokenExpiresAt } = await prisma.user.findUniqueOrThrow({
        where: { email },
      });
      expect(resetToken).toBeTruthy();
      expect(resetTokenExpiresAt).not.toBeNull();
      expect(resetTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());

      await page.goto(`/en/reset-password?token=${resetToken}`);
      await page.fill("#password", "temporary-new-password-1");
      await page.click('button:has-text("Reset password")');
      await expect(page.getByText(/password has been reset/i)).toBeVisible();

      // The token must not be reusable a second time.
      await page.goto(`/en/reset-password?token=${resetToken}`);
      await page.fill("#password", "another-password-2");
      await page.click('button:has-text("Reset password")');
      await expect(page.getByText(/invalid or has expired/i)).toBeVisible();

      // The new password actually works.
      await page.goto("/en/login");
      await page.fill("#email", email);
      await page.fill("#password", "temporary-new-password-1");
      await Promise.all([
        page.waitForURL((url) => !url.pathname.endsWith("/login")),
        page.click('button[type="submit"]'),
      ]);
      await expect(page).toHaveURL(/\/en\/portal/);
    } finally {
      await prisma.user.update({ where: { email }, data: { passwordHash: originalHash } });
    }
  });
});
