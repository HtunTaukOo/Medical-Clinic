import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

function futureWeekdayAt(daysAhead: number, hours: number, minutes: number) {
  let cursor = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  let weekday = cursor.getUTCDay();
  while (weekday === 0 || weekday === 6) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    weekday = cursor.getUTCDay();
  }
  cursor.setHours(hours, minutes, 0, 0);
  return cursor;
}

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test.describe("Recurring appointments (staff only)", () => {
  test("staff can book a weekly recurring series", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const start = futureWeekdayAt(90, 9, 0);

    try {
      await loginAs(page, "receptionist@nca.clinic");
      await page.goto("/en/staff/appointments/new");

      await page.locator("#patientId").click();
      await page.getByRole("option", { name: patient.name }).click();
      await page.locator("#doctorId").click();
      await page.getByRole("option").first().click();
      await page.fill('input[name="scheduledAt"]', toDatetimeLocal(start));
      await page.check('input[name="repeatWeekly"]');
      await page.fill("#occurrences", "3");
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/Booked 3 weekly appointments/i)).toBeVisible();

      const created = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: { gte: start, lte: new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { scheduledAt: "asc" },
      });
      expect(created.length).toBe(3);
      expect(created[1].scheduledAt.getTime() - created[0].scheduledAt.getTime()).toBe(
        7 * 24 * 60 * 60 * 1000
      );
      expect(created[2].scheduledAt.getTime() - created[1].scheduledAt.getTime()).toBe(
        7 * 24 * 60 * 60 * 1000
      );

      await prisma.appointment.deleteMany({ where: { id: { in: created.map((c) => c.id) } } });
    } finally {
      await prisma.appointment.deleteMany({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: { gte: start, lte: new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000) },
        },
      });
    }
  });

  test("a conflicting occurrence in the series is skipped, not fatal", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const start = futureWeekdayAt(100, 9, 0);
    const secondOccurrence = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const blocker = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt: secondOccurrence,
        status: "CONFIRMED",
      },
    });

    try {
      await loginAs(page, "receptionist@nca.clinic");
      await page.goto("/en/staff/appointments/new");

      await page.locator("#patientId").click();
      await page.getByRole("option", { name: patient.name }).click();
      await page.locator("#doctorId").click();
      await page.getByRole("option").first().click();
      await page.fill('input[name="scheduledAt"]', toDatetimeLocal(start));
      await page.check('input[name="repeatWeekly"]');
      await page.fill("#occurrences", "3");
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/Booked 2 weekly appointments/i)).toBeVisible();
      await expect(page.getByText(/Skipped/i)).toBeVisible();

      const created = await prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: { gte: start, lte: new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000) },
          id: { not: blocker.id },
        },
      });
      expect(created).toBe(2);
    } finally {
      await prisma.appointment.deleteMany({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: { gte: start, lte: new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000) },
        },
      });
    }
  });
});
