import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Walk-in queue (staff)", () => {
  const createdWalkInIds: string[] = [];
  const createdPatientIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  test.afterEach(async () => {
    for (const id of createdAppointmentIds.splice(0)) {
      await prisma.appointment.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdWalkInIds.splice(0)) {
      await prisma.walkIn.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdPatientIds.splice(0)) {
      await prisma.patient.delete({ where: { id } }).catch(() => {});
    }
  });

  test("a receptionist can register a fully anonymous walk-in and gets a token number", async ({
    page,
  }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto("/en/staff/queue");

    await page.click('button:has-text("Register walk-in")');
    await expect(page.getByText(/Token issued: #\d+/)).toBeVisible();

    const walkIn = await prisma.walkIn.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    createdWalkInIds.push(walkIn.id);
    expect(walkIn.status).toBe("WAITING");
    expect(walkIn.name).toBeNull();

    const row = page
      .locator("div")
      .filter({ hasText: `#${walkIn.tokenNumber}` })
      .filter({ has: page.getByRole("button", { name: "Call" }) })
      .last();
    await expect(row.getByText("Walk-in", { exact: true })).toBeVisible();
    await expect(row.getByText("No reason given")).toBeVisible();
  });

  test("calling a walk-in and starting a visit creates a checked-in appointment", async ({
    page,
  }) => {
    const walkIn = await prisma.walkIn.create({
      data: { tokenNumber: 9001, name: "Kyaw Test", phone: "09999999", reason: "Fever" },
    });
    createdWalkInIds.push(walkIn.id);

    await loginAs(page, "receptionist@nca.clinic");
    await page.goto("/en/staff/queue");

    const waitingRow = page
      .locator("div")
      .filter({ hasText: "Kyaw Test" })
      .filter({ has: page.getByRole("button", { name: "Call" }) })
      .last();
    await waitingRow.getByRole("button", { name: "Call" }).click();

    await expect(page.getByText("Walk-ins called")).toBeVisible();
    const calledRow = page
      .locator("div")
      .filter({ hasText: "Kyaw Test" })
      .filter({ has: page.getByRole("link", { name: "Start visit" }) })
      .last();
    await calledRow.getByRole("link", { name: "Start visit" }).click();

    await page.waitForURL(`**/staff/queue/walk-ins/${walkIn.id}`);
    await expect(page.getByText("Fever")).toBeVisible();

    await page.fill("#newPatientName", `Walk-in Patient ${Date.now()}`);
    await page.locator("#doctorId").click();
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });
    await page.getByRole("option", { name: doctor.user.name }).click();
    await page.click('button:has-text("Start visit")');

    await page.waitForURL(/\/staff\/appointments\/.+/);

    const completedWalkIn = await prisma.walkIn.findUniqueOrThrow({
      where: { id: walkIn.id },
      include: { appointment: true, patient: true },
    });
    expect(completedWalkIn.status).toBe("COMPLETED");
    expect(completedWalkIn.appointment).not.toBeNull();
    expect(completedWalkIn.appointment!.status).toBe("CHECKED_IN");
    expect(completedWalkIn.appointment!.doctorId).toBe(doctor.id);
    expect(completedWalkIn.patient).not.toBeNull();

    createdAppointmentIds.push(completedWalkIn.appointment!.id);
    createdPatientIds.push(completedWalkIn.patient!.id);
  });

  test("cancelling a waiting walk-in removes it from the waiting list", async ({ page }) => {
    const walkIn = await prisma.walkIn.create({
      data: { tokenNumber: 9002, name: "Cancel Me" },
    });
    createdWalkInIds.push(walkIn.id);

    await loginAs(page, "receptionist@nca.clinic");
    await page.goto("/en/staff/queue");

    const row = page
      .locator("div")
      .filter({ hasText: "Cancel Me" })
      .filter({ has: page.getByRole("button", { name: "Cancel" }) })
      .last();
    await row.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByText("Cancel Me")).toHaveCount(0);

    const cancelled = await prisma.walkIn.findUniqueOrThrow({ where: { id: walkIn.id } });
    expect(cancelled.status).toBe("CANCELLED");
  });

  test("a doctor does not see walk-in registration controls on the queue page", async ({
    page,
  }) => {
    await loginAs(page, "doctor@nca.clinic");
    await page.goto("/en/staff/queue");

    await expect(page.getByText("Register walk-in")).toHaveCount(0);
    await expect(page.getByText("Walk-ins waiting")).toHaveCount(0);
  });
});

test.describe("Public queue display", () => {
  let walkInId: string;

  test.afterEach(async () => {
    await prisma.walkIn.delete({ where: { id: walkInId } }).catch(() => {});
  });

  test("shows token numbers only, with no login and no patient names", async ({ browser }) => {
    const walkIn = await prisma.walkIn.create({
      data: { tokenNumber: 9101, name: "Secret Name", status: "CALLED", calledAt: new Date() },
    });
    walkInId = walkIn.id;

    // A brand-new, unauthenticated context — this page must not require login.
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto("/en/queue-display");
    expect(response?.status()).toBe(200);

    await expect(page.getByText(String(walkIn.tokenNumber)).first()).toBeVisible();
    await expect(page.getByText("Secret Name")).toHaveCount(0);

    await context.close();
  });
});
