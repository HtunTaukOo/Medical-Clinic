import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Medicine expiry tracking", () => {
  let medicineId: string;

  test.afterEach(async () => {
    if (medicineId) {
      await prisma.medicine.delete({ where: { id: medicineId } }).catch(() => {});
    }
  });

  test("a pharmacist can set an expiry date on a new medicine and see an expired badge", async ({
    page,
  }) => {
    await loginAs(page, "pharmacist@nca.clinic");
    await page.goto("/en/staff/inventory/new");

    await page.fill("#name", "Test Expiring Med");
    await page.fill("#unit", "tablet");
    await page.fill("#stockQty", "50");
    await page.fill("#reorderLevel", "10");
    await page.fill("#price", "1.50");
    await page.fill("#expiryDate", "2020-01-01");
    await page.click('button:has-text("New medicine")');
    await page.waitForLoadState("networkidle");

    const medicine = await prisma.medicine.findFirstOrThrow({
      where: { name: "Test Expiring Med" },
    });
    medicineId = medicine.id;
    expect(medicine.expiryDate?.toISOString().slice(0, 10)).toBe("2020-01-01");

    await page.goto("/en/staff/inventory");
    await expect(page.getByText("Expired").first()).toBeVisible();
  });

  test("editing the expiry date on the medicine detail page updates it", async ({ page }) => {
    const medicine = await prisma.medicine.create({
      data: { name: "Test Detail Med", unit: "bottle", stockQty: 5, reorderLevel: 2, price: 3 },
    });
    medicineId = medicine.id;

    await loginAs(page, "pharmacist@nca.clinic");
    await page.goto(`/en/staff/inventory/${medicineId}`);
    await expect(page.getByText("No expiry date set.")).toBeVisible();

    const future = new Date();
    future.setDate(future.getDate() + 10);
    const futureStr = future.toISOString().slice(0, 10);

    await page.fill('input[name="expiryDate"]', futureStr);
    await page.click('button:has-text("Save")');
    await page.waitForLoadState("networkidle");

    const updated = await prisma.medicine.findUniqueOrThrow({ where: { id: medicineId } });
    expect(updated.expiryDate?.toISOString().slice(0, 10)).toBe(futureStr);
    await expect(page.getByText("Expiring soon").first()).toBeVisible();
  });
});
