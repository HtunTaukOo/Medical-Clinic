import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Billing", () => {
  let patientId: string;
  let invoiceId: string;

  test.beforeEach(async () => {
    const patient = await prisma.patient.create({
      data: { name: `Billing Test Patient ${Date.now()}` },
    });
    patientId = patient.id;

    const invoice = await prisma.invoice.create({
      data: {
        patientId,
        total: 1000,
        items: { create: [{ description: "Consultation", quantity: 1, unitPrice: 1000 }] },
      },
    });
    invoiceId = invoice.id;
  });

  test.afterEach(async () => {
    await prisma.payment.deleteMany({ where: { invoiceId } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
    await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    await prisma.patient.delete({ where: { id: patientId } }).catch(() => {});
  });

  test("recording a full payment marks the invoice PAID", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await page.fill("#amount", "1000");
    await page.click('button:has-text("Record payment")');
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
  });

  test("a partial payment marks the invoice PARTIAL", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await page.fill("#amount", "400");
    await page.click('button:has-text("Record payment")');
    await expect(page.getByText("PARTIAL", { exact: true })).toBeVisible();
  });

  test("adding a line item increases the total", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await page.fill('input[placeholder="Description"]', "Lab test");
    await page.fill('input[placeholder="Qty"]', "1");
    await page.fill('input[placeholder="Unit price"]', "250");
    await page.click('button:has-text("Add item")');
    await expect(page.getByText("Total: 1250.00")).toBeVisible();
  });

  test("removing a line item decreases the total", async ({ page }) => {
    await prisma.invoiceItem.create({
      data: { invoiceId, description: "Extra item", quantity: 1, unitPrice: 500 },
    });
    // The app only recomputes the denormalized Invoice.total from its own actions,
    // so a fixture inserted directly via Prisma must update it too.
    await prisma.invoice.update({ where: { id: invoiceId }, data: { total: 1500 } });

    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await expect(page.getByText("Total: 1500.00")).toBeVisible();
    await page.locator("table tbody tr", { hasText: "Extra item" }).locator("button").click();
    await expect(page.getByText("Total: 1000.00")).toBeVisible();
  });

  test("an admin can void a payment, reverting PAID back to UNPAID", async ({ page }) => {
    await prisma.payment.create({ data: { invoiceId, amount: 1000, method: "CASH" } });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });

    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();
    await page.click('button:has-text("Void")');
    await expect(page.getByText("UNPAID", { exact: true }).first()).toBeVisible();

    const paymentCount = await prisma.payment.count({ where: { invoiceId } });
    expect(paymentCount).toBe(0);
  });

  test("a fully paid invoice can no longer be edited", async ({ page }) => {
    await prisma.payment.create({ data: { invoiceId, amount: 1000, method: "CASH" } });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });

    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await expect(page.locator('input[placeholder="Description"]')).toHaveCount(0);
  });
});
