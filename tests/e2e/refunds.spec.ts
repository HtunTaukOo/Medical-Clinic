import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Refunds", () => {
  let patientId: string;
  let invoiceId: string;
  let paymentId: string;

  test.beforeEach(async () => {
    const patient = await prisma.patient.create({
      data: { name: `Refund Test Patient ${Date.now()}` },
    });
    patientId = patient.id;

    const invoice = await prisma.invoice.create({
      data: {
        patientId,
        total: 1000,
        status: "PAID",
        items: { create: [{ description: "Consultation", quantity: 1, unitPrice: 1000 }] },
      },
    });
    invoiceId = invoice.id;

    const payment = await prisma.payment.create({
      data: { invoiceId, amount: 1000, method: "CASH" },
    });
    paymentId = payment.id;
  });

  test.afterEach(async () => {
    await prisma.refund.deleteMany({ where: { paymentId } });
    await prisma.payment.deleteMany({ where: { invoiceId } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
    await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    await prisma.patient.delete({ where: { id: patientId } }).catch(() => {});
  });

  test("a full refund reverts a paid invoice back to unpaid", async ({ page }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();

    await page.fill('input[name="reason"]', "Patient cancelled");
    await page.click('button:has-text("Refund")');
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("UNPAID", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Refunded: 1000\.00/)).toBeVisible();
    await expect(page.getByText(/Patient cancelled/)).toBeVisible();

    const refund = await prisma.refund.findFirstOrThrow({ where: { paymentId } });
    expect(Number(refund.amount)).toBe(1000);

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(updated.status).toBe("UNPAID");
  });

  test("a partial refund moves a paid invoice to partial and leaves the rest refundable", async ({
    page,
  }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    const refundAmountInput = page.locator(`#refund-amount-${paymentId}`);
    await refundAmountInput.fill("300");
    await page.click('button:has-text("Refund")');
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("PARTIAL", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Refunded: 300\.00/)).toBeVisible();
    // The refund form should still be present, now capped at the remaining 700.
    await expect(page.locator(`#refund-amount-${paymentId}`)).toHaveValue("700.00");
  });

  test("the server rejects a refund that exceeds the remaining refundable amount", async ({
    page,
  }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    // Simulate a client bypassing the HTML max= constraint.
    const refundAmountInput = page.locator(`#refund-amount-${paymentId}`);
    await refundAmountInput.evaluate((el) => el.removeAttribute("max"));
    await refundAmountInput.fill("1500");
    await page.click('button:has-text("Refund")');

    await expect(page.getByText(/Cannot refund more than/)).toBeVisible();

    const refundCount = await prisma.refund.count({ where: { paymentId } });
    expect(refundCount).toBe(0);
  });

  test("a receptionist does not see refund controls (admin-only)", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    await expect(page.locator('button:has-text("Refund")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Void")')).toHaveCount(0);
  });
});
