import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Package pricing", () => {
  let packageIds: string[] = [];
  let patientId: string | undefined;
  let invoiceId: string | undefined;

  test.afterEach(async () => {
    if (invoiceId) {
      await prisma.payment.deleteMany({ where: { invoiceId } });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
      await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
      invoiceId = undefined;
    }
    if (patientId) {
      await prisma.patient.delete({ where: { id: patientId } }).catch(() => {});
      patientId = undefined;
    }
    for (const id of packageIds) {
      await prisma.package.delete({ where: { id } }).catch(() => {});
    }
    packageIds = [];
  });

  test("an admin can create a package and use it as a quick-pick when creating an invoice", async ({
    page,
  }) => {
    const patient = await prisma.patient.create({
      data: { name: `Package Test Patient ${Date.now()}` },
    });
    patientId = patient.id;

    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/billing/packages");

    await page.fill("#package-name", "Full Checkup Package");
    await page.fill("#package-price", "50000");
    await page.click('button:has-text("New package")');
    // Wait on the UI reflecting the mutation, not just "networkidle" — a
    // dev-mode server action's first invocation can be slow enough to
    // outrace a fixed idle check, and this app has hit that before.
    await expect(page.getByText("Full Checkup Package")).toBeVisible();

    const pkg = await prisma.package.findFirstOrThrow({
      where: { name: "Full Checkup Package" },
    });
    packageIds.push(pkg.id);
    expect(pkg.active).toBe(true);

    await page.goto("/en/staff/billing/new");
    await page.locator("#patientId").click();
    await page.getByRole("option", { name: patient.name }).click();

    await page.getByText("Add package").click();
    await page.getByRole("option", { name: /Full Checkup Package/ }).click();

    await expect(page.locator('input[placeholder="Description"]').last()).toHaveValue(
      "Full Checkup Package"
    );
    await page.click('button:has-text("New invoice")');
    await page.waitForURL("**/staff/billing");

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { patientId } });
    invoiceId = invoice.id;
    expect(Number(invoice.total)).toBe(50000);
  });

  test("deactivating a package removes it from new quick-pick lists", async ({ page }) => {
    const pkg = await prisma.package.create({
      data: { name: "Retired Package", price: 1234 },
    });
    // A second, still-active package so the quick-pick keeps rendering after
    // the one under test is deactivated.
    const control = await prisma.package.create({
      data: { name: "Control Package", price: 999 },
    });
    packageIds.push(pkg.id, control.id);

    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/billing/packages");
    await page
      .locator("div")
      .filter({ hasText: "Retired Package" })
      .filter({ has: page.getByRole("button", { name: "Deactivate" }) })
      .last()
      .getByRole("button", { name: "Deactivate" })
      .click();
    await page.waitForLoadState("networkidle");

    const updated = await prisma.package.findUniqueOrThrow({ where: { id: pkg.id } });
    expect(updated.active).toBe(false);

    await page.goto("/en/staff/billing/new");
    await page.getByText("Add package").click();
    await expect(page.getByRole("option", { name: /Control Package/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Retired Package/ })).toHaveCount(0);
  });

  test("adding a package to an existing invoice fills in description and price", async ({
    page,
  }) => {
    const patient = await prisma.patient.create({
      data: { name: `Package Invoice Patient ${Date.now()}` },
    });
    patientId = patient.id;
    const invoice = await prisma.invoice.create({
      data: {
        patientId: patient.id,
        total: 1000,
        items: { create: [{ description: "Consultation", quantity: 1, unitPrice: 1000 }] },
      },
    });
    invoiceId = invoice.id;

    const pkg = await prisma.package.create({
      data: { name: "Blood Panel Package", price: 25000 },
    });
    packageIds.push(pkg.id);

    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    await page.getByText("Add package").click();
    await page.getByRole("option", { name: /Blood Panel Package/ }).click();

    await expect(page.locator('input[name="description"]')).toHaveValue(
      "Blood Panel Package"
    );
    await expect(page.locator('input[name="unitPrice"]')).toHaveValue("25000");

    await page.click('button:has-text("Add item")');
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Total: 26000.00")).toBeVisible();
  });
});
