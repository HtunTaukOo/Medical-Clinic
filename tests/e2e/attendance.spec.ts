import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Staff attendance", () => {
  test.afterEach(async () => {
    const receptionist = await prisma.user.findFirstOrThrow({
      where: { email: "receptionist@nca.clinic" },
    });
    await prisma.attendanceRecord.deleteMany({ where: { userId: receptionist.id } });
  });

  test("a staff member can clock in, see it reflected, then clock out", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto("/en/staff/attendance");

    await expect(page.getByText("Not clocked in")).toBeVisible();
    await page.click('button:has-text("Clock in")');
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Clocked in since/)).toBeVisible();

    const receptionist = await prisma.user.findFirstOrThrow({
      where: { email: "receptionist@nca.clinic" },
    });
    const open = await prisma.attendanceRecord.findFirstOrThrow({
      where: { userId: receptionist.id, clockOut: null },
    });
    expect(open).toBeTruthy();

    await page.click('button:has-text("Clock out")');
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Not clocked in")).toBeVisible();

    const closed = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: open.id } });
    expect(closed.clockOut).not.toBeNull();
  });

  test("an admin sees a today's-attendance table for all staff", async ({ page }) => {
    const receptionist = await prisma.user.findFirstOrThrow({
      where: { email: "receptionist@nca.clinic" },
    });
    await prisma.attendanceRecord.create({
      data: { userId: receptionist.id, clockIn: new Date() },
    });

    await loginAs(page, "admin@nca.clinic");
    await page.goto("/en/staff/attendance");

    await expect(page.getByText("Today — all staff")).toBeVisible();
    await expect(page.getByText(/Front Desk/).first()).toBeVisible();
  });
});
