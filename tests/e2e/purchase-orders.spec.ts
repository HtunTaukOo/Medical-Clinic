import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Suppliers", () => {
  let supplierId: string | undefined;

  test.afterEach(async () => {
    if (supplierId) {
      await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
      supplierId = undefined;
    }
  });

  test("an admin can create a supplier", async ({ page }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/inventory/suppliers");

    await page.fill("#supplier-name", "Acme Pharma Supplies");
    await page.fill("#supplier-contact", "Daw Hla");
    await page.fill("#supplier-phone", "09123456789");
    await page.click('button:has-text("New supplier")');

    await expect(page.getByText("Acme Pharma Supplies")).toBeVisible();

    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { name: "Acme Pharma Supplies" },
    });
    supplierId = supplier.id;
    expect(supplier.active).toBe(true);
    expect(supplier.contactName).toBe("Daw Hla");
  });
});

test.describe("Purchase orders", () => {
  let supplierId: string;
  let medicineId: string;
  let purchaseOrderId: string | undefined;

  test.beforeEach(async () => {
    const supplier = await prisma.supplier.create({
      data: { name: `PO Test Supplier ${Date.now()}` },
    });
    supplierId = supplier.id;

    const medicine = await prisma.medicine.create({
      data: { name: `PO Test Medicine ${Date.now()}`, unit: "box", stockQty: 10, price: 5 },
    });
    medicineId = medicine.id;
  });

  test.afterEach(async () => {
    if (purchaseOrderId) {
      await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } }).catch(() => {});
      purchaseOrderId = undefined;
    }
    await prisma.stockTransaction.deleteMany({ where: { medicineId } });
    await prisma.medicine.delete({ where: { id: medicineId } }).catch(() => {});
    await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
  });

  test("creating a purchase order, marking it ordered, and receiving stock in two batches updates medicine stock", async ({
    page,
  }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/inventory/purchase-orders/new");

    await page.locator("#supplierId").click();
    await page.getByRole("option", { name: /PO Test Supplier/ }).click();

    await page.locator("#po-medicine-0").click();
    await page.getByRole("option", { name: /PO Test Medicine/ }).click();

    await page.fill('input[type="number"][min="1"]', "50");
    await page.click('button:has-text("New purchase order")');
    await page.waitForURL("**/staff/inventory/purchase-orders");

    const order = await prisma.purchaseOrder.findFirstOrThrow({
      where: { supplierId },
      include: { items: true },
    });
    purchaseOrderId = order.id;
    expect(order.status).toBe("DRAFT");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(50);
    expect(Number(order.items[0].unitCost)).toBe(5);

    await page.goto(`/en/staff/inventory/purchase-orders/${order.id}`);
    await page.click('button:has-text("Mark as ordered")');
    await expect(page.getByText("ORDERED", { exact: true }).first()).toBeVisible();

    const itemId = order.items[0].id;
    await page.fill(`input[name="receive_${itemId}"]`, "20");
    await page.click('button:has-text("Receive stock")');
    await expect(page.getByText("PARTIALLY_RECEIVED", { exact: true }).first()).toBeVisible();

    let medicine = await prisma.medicine.findUniqueOrThrow({ where: { id: medicineId } });
    expect(medicine.stockQty).toBe(30);

    await page.fill(`input[name="receive_${itemId}"]`, "30");
    await page.click('button:has-text("Receive stock")');
    await expect(page.getByText("RECEIVED", { exact: true }).first()).toBeVisible();

    medicine = await prisma.medicine.findUniqueOrThrow({ where: { id: medicineId } });
    expect(medicine.stockQty).toBe(60);

    const finalItem = await prisma.purchaseOrderItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(finalItem.receivedQty).toBe(50);

    const transactions = await prisma.stockTransaction.count({ where: { medicineId } });
    expect(transactions).toBe(2);
  });

  test("a draft purchase order can be cancelled", async ({ page }) => {
    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        createdById: (await prisma.user.findFirstOrThrow({ where: { email: "admin@nca.clinic" } }))
          .id,
        items: { create: [{ medicineId, quantity: 10, unitCost: 5 }] },
      },
    });
    purchaseOrderId = order.id;

    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/inventory/purchase-orders/${order.id}`);
    await page.click('button:has-text("Cancel order")');
    await expect(page.getByText("CANCELLED", { exact: true }).first()).toBeVisible();

    const cancelled = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(cancelled.status).toBe("CANCELLED");

    const medicine = await prisma.medicine.findUniqueOrThrow({ where: { id: medicineId } });
    expect(medicine.stockQty).toBe(10);
  });

  test("a receptionist cannot access the purchase orders page", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    const response = await page.goto("/en/staff/inventory/purchase-orders");
    expect(response?.status()).toBe(200);
    expect(page.url()).not.toContain("/purchase-orders");
    expect(page.url()).toContain("/staff");
  });
});
