import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("External lab referral tracking", () => {
  let patientId: string;

  test.beforeEach(async () => {
    await prisma.labTest.upsert({
      where: { id: "seed-labtest-thyroid-external" },
      update: { requiresExternalLab: true },
      create: {
        id: "seed-labtest-thyroid-external",
        name: "Thyroid Panel (External)",
        unit: "mIU/L",
        normalRange: "0.4–4.0",
        price: 25000,
        requiresExternalLab: true,
      },
    });

    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    patientId = patient.id;
  });

  test.afterEach(async () => {
    await prisma.externalLabReferral.deleteMany({ where: { patientId } });
  });

  test("staff log a referral, mark one received, and cancel another", async ({ page }) => {
    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/lab?tab=external");

    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });

    // --- Create a referral ---
    await page.getByPlaceholder("Search patient...").fill(patient.name);
    await page.getByRole("button", { name: patient.name }).click();

    await page.locator("#testId").click();
    await page.getByRole("option", { name: /Thyroid Panel \(External\)/ }).click();
    await expect(page.getByText("This test is known to need an outside lab.")).toBeVisible();

    await page.getByLabel("Referred Lab").fill("City Diagnostic Lab");
    await page.getByRole("button", { name: "Log Referral" }).click();
    await expect(page.getByText("Referral created.")).toBeVisible();

    const referral = await prisma.externalLabReferral.findFirstOrThrow({
      where: { patientId, referredLabName: "City Diagnostic Lab" },
    });
    expect(referral.status).toBe("SENDING");

    const row = page.locator("tr", { hasText: "City Diagnostic Lab" });
    await expect(row.getByText(patient.name)).toBeVisible();
    await expect(row.getByText("Thyroid Panel (External)")).toBeVisible();
    await expect(row.getByText("Sending", { exact: true })).toBeVisible();

    // --- Mark received ---
    await row.getByRole("button", { name: "Mark Received" }).click();
    await expect(row.getByText("Received", { exact: true })).toBeVisible();
    const received = await prisma.externalLabReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(received.status).toBe("RECEIVED");
    expect(received.receivedAt).not.toBeNull();

    // --- Enter results (with document upload) ---
    const enterResultsLink = row.getByRole("link", { name: "Enter results" });
    await expect(enterResultsLink).toBeVisible();
    await enterResultsLink.click();
    await page.waitForURL(`**/staff/lab/external/${referral.id}`);
    await expect(page.getByText("Thyroid Panel (External)")).toBeVisible();

    await page.locator('input[id^="result-"]').first().fill("2.1");
    await page.locator("#document").setInputFiles({
      name: "referral-form.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%test referral document\n"),
    });
    await page.click('button:has-text("Save results")');
    await expect(page.getByText(/Result: 2\.1/)).toBeVisible();

    const referralItem = await prisma.externalLabReferralItem.findFirstOrThrow({
      where: { externalLabReferralId: referral.id },
    });
    expect(referralItem.resultValue).toBe("2.1");
    expect(referralItem.resultEnteredAt).not.toBeNull();

    const withDocument = await prisma.externalLabReferral.findUniqueOrThrow({ where: { id: referral.id } });
    expect(withDocument.documentName).toBe("referral-form.pdf");

    const fileResponse = await page.request.get(`/api/external-lab-referrals/${referral.id}/file`);
    expect(fileResponse.status()).toBe(200);
    expect(fileResponse.headers()["content-type"]).toBe("application/pdf");

    await page.goto("/en/staff/lab?tab=external");
    const completedRow = page.locator("tr", { hasText: "City Diagnostic Lab" });
    await expect(completedRow.getByText("Received", { exact: true })).toBeVisible();
    await expect(completedRow.getByRole("link", { name: "Enter results" })).not.toBeVisible();
    await expect(completedRow.locator(`a[href="/api/external-lab-referrals/${referral.id}/file"]`)).toBeVisible();

    // --- Create a second referral and cancel it ---
    await page.getByPlaceholder("Search patient...").fill(patient.name);
    await page.getByRole("button", { name: patient.name }).click();
    await page.locator("#testId").click();
    await page.getByRole("option", { name: /Thyroid Panel \(External\)/ }).click();
    await page.getByLabel("Referred Lab").fill("Second Referral Lab");
    await page.getByRole("button", { name: "Log Referral" }).click();

    const secondRow = page.locator("tr", { hasText: "Second Referral Lab" });
    await expect(secondRow.getByText("Sending", { exact: true })).toBeVisible();
    await secondRow.getByRole("button", { name: "Cancel" }).click();
    await expect(secondRow.getByText("Cancelled", { exact: true })).toBeVisible();

    const cancelled = await prisma.externalLabReferral.findFirstOrThrow({
      where: { patientId, referredLabName: "Second Referral Lab" },
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
  });
});
