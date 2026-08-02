import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Insurance claims", () => {
  let patientId: string;
  let invoiceId: string;

  test.beforeEach(async () => {
    const patient = await prisma.patient.create({
      data: {
        name: `Insurance Test Patient ${Date.now()}`,
        insuranceProvider: "Myanmar Insurance Co",
        insurancePolicyNumber: "POL-12345",
      },
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
    await prisma.insuranceClaim.deleteMany({ where: { invoiceId } });
    await prisma.payment.deleteMany({ where: { invoiceId } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
    await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    await prisma.patient.delete({ where: { id: patientId } }).catch(() => {});
  });

  test("a receptionist can submit a claim prefilled from the patient's insurance info", async ({
    page,
  }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    await expect(page.locator("#claim-provider")).toHaveValue("Myanmar Insurance Co");
    await expect(page.locator("#claim-policy")).toHaveValue("POL-12345");

    await page.fill("#claim-amount", "800");
    await page.click('button:has-text("Submit claim")');

    await expect(page.getByText("SUBMITTED", { exact: true })).toBeVisible();

    const claim = await prisma.insuranceClaim.findFirstOrThrow({ where: { invoiceId } });
    expect(claim.status).toBe("SUBMITTED");
    expect(Number(claim.claimedAmount)).toBe(800);
  });

  test("approving then marking a claim paid records an insurance payment and updates invoice status", async ({
    page,
  }) => {
    const claim = await prisma.insuranceClaim.create({
      data: {
        invoiceId,
        patientId,
        insuranceProvider: "Myanmar Insurance Co",
        policyNumber: "POL-12345",
        claimedAmount: 1000,
      },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    await page.fill('input[name="approvedAmount"]', "900");
    await page.click('button:has-text("Approve")');

    // Wait on the UI reflecting the mutation (not just "networkidle", which can
    // resolve before a dev-mode server action — especially its first, on-demand
    // Turbopack-compiled invocation — has actually finished writing to the DB).
    await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();

    const approved = await prisma.insuranceClaim.findUniqueOrThrow({ where: { id: claim.id } });
    expect(approved.status).toBe("APPROVED");
    expect(Number(approved.approvedAmount)).toBe(900);

    await page.click('button:has-text("Mark paid")');
    await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();

    const paid = await prisma.insuranceClaim.findUniqueOrThrow({
      where: { id: claim.id },
      include: { payment: true },
    });
    expect(paid.status).toBe("PAID");
    expect(paid.payment).not.toBeNull();
    expect(Number(paid.payment!.amount)).toBe(900);
    expect(paid.payment!.method).toBe("INSURANCE");

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe("PARTIAL");
    await expect(page.getByText("PARTIAL", { exact: true }).first()).toBeVisible();
  });

  test("rejecting a claim requires no payment and leaves the invoice unaffected", async ({
    page,
  }) => {
    const claim = await prisma.insuranceClaim.create({
      data: {
        invoiceId,
        patientId,
        insuranceProvider: "Myanmar Insurance Co",
        policyNumber: "POL-12345",
        claimedAmount: 1000,
      },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);
    await page.click('button:has-text("Reject")');
    await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();

    const rejected = await prisma.insuranceClaim.findUniqueOrThrow({ where: { id: claim.id } });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.paymentId).toBeNull();

    const paymentCount = await prisma.payment.count({ where: { invoiceId } });
    expect(paymentCount).toBe(0);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe("UNPAID");
  });

  test("the server rejects an approved amount exceeding what was claimed", async ({ page }) => {
    const claim = await prisma.insuranceClaim.create({
      data: {
        invoiceId,
        patientId,
        insuranceProvider: "Myanmar Insurance Co",
        policyNumber: "POL-12345",
        claimedAmount: 500,
      },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto(`/en/staff/billing/${invoiceId}`);

    const amountInput = page.locator('input[name="approvedAmount"]');
    await amountInput.evaluate((el) => el.removeAttribute("max"));
    await amountInput.fill("600");
    await page.click('button:has-text("Approve")');

    await expect(page.getByText(/cannot exceed the claimed amount/i)).toBeVisible();

    const stillSubmitted = await prisma.insuranceClaim.findUniqueOrThrow({
      where: { id: claim.id },
    });
    expect(stillSubmitted.status).toBe("SUBMITTED");
  });

  test("the claims tracking page lists claims across patients and links back to their invoice", async ({
    page,
  }) => {
    await prisma.insuranceClaim.create({
      data: {
        invoiceId,
        patientId,
        insuranceProvider: "Myanmar Insurance Co",
        policyNumber: "POL-12345",
        claimedAmount: 750,
      },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/billing/claims");

    const row = page.locator("tr", { hasText: "Myanmar Insurance Co" }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("750.00")).toBeVisible();

    await row.getByRole("link").click();
    await page.waitForURL(`**/staff/billing/${invoiceId}`);
  });
});
