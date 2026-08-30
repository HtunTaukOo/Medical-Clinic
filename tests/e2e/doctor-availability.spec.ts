import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

// Matches CLINIC_UTC_OFFSET_MINUTES in src/lib/clinic-hours.ts (Asia/Yangon, fixed, no DST).
const CLINIC_UTC_OFFSET_MINUTES = 6 * 60 + 30;

function clinicMidnightForYMD(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - CLINIC_UTC_OFFSET_MINUTES * 60 * 1000);
}

// Picks a future weekday, working entirely in UTC calendar arithmetic so it's
// independent of the test runner's own local timezone, then returns the same
// clinic-local-midnight instant the app itself would compute for that date.
function futureWeekday(daysAhead: number) {
  let cursor = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  let year = cursor.getUTCFullYear();
  let month = cursor.getUTCMonth() + 1;
  let day = cursor.getUTCDate();
  let weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  while (weekday === 0 || weekday === 6) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    year = cursor.getUTCFullYear();
    month = cursor.getUTCMonth() + 1;
    day = cursor.getUTCDate();
    weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }
  return clinicMidnightForYMD(year, month, day);
}

// The calendar starts on the current month and doesn't auto-navigate, so hop
// forward with the "›" control until the target date's button appears.
async function navigateToDate(page: import("@playwright/test").Page, isoDate: string) {
  for (let i = 0; i < 12; i++) {
    const btn = page.getByRole("button", { name: isoDate, exact: true });
    if ((await btn.count()) > 0) return btn;
    await page.getByRole("button", { name: "›", exact: true }).click();
  }
  throw new Error(`Could not find calendar date ${isoDate} within 12 months`);
}

test.describe("Doctor availability", () => {
  test("an admin can set a doctor's weekly hours and manage leave days", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });

    try {
      await loginAs(page, "admin@nca.clinic");
      await page.goto(`/en/staff/users/${doctor.id}/availability`);

      await page.fill('input[name="workStartTime"]', "09:00");
      await page.fill('input[name="workEndTime"]', "12:00");
      await page.click('button:has-text("Save schedule")');
      await page.waitForLoadState("networkidle");

      await expect.poll(async () => {
        const updated = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctor.id } });
        return updated.workStartTime;
      }).toBe("09:00");

      const leaveDate = futureWeekday(45);
      const dateInputValue = `${leaveDate.getFullYear()}-${String(leaveDate.getMonth() + 1).padStart(2, "0")}-${String(leaveDate.getDate()).padStart(2, "0")}`;
      await page.fill('input[name="date"]', dateInputValue);
      await page.fill('input[name="reason"]', "Conference");
      await page.click('button:has-text("Add leave day")');
      await expect(page.getByText("Conference")).toBeVisible();

      await expect.poll(async () => {
        const row = await prisma.doctorLeave.findUnique({
          where: { doctorId_date: { doctorId: doctor.id, date: leaveDate } },
        });
        return row?.reason ?? null;
      }).toBe("Conference");

      const leave = await prisma.doctorLeave.findUniqueOrThrow({
        where: { doctorId_date: { doctorId: doctor.id, date: leaveDate } },
      });

      await page.getByRole("button", { name: "Remove" }).first().click();
      await expect(page.getByText("Conference")).not.toBeVisible();

      await expect.poll(async () => {
        return prisma.doctorLeave.findUnique({ where: { id: leave.id } });
      }).toBeNull();
    } finally {
      await prisma.doctorProfile.update({
        where: { id: doctor.id },
        data: { workStartTime: null, workEndTime: null, workingDays: [1, 2, 3, 4, 5] },
      });
      await prisma.doctorLeave.deleteMany({ where: { doctorId: doctor.id } });
    }
  });

  test("the booking wizard calendar disables a doctor's leave day", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });
    // A small, in-window offset (the wizard's calendar starts on the current month).
    const leaveDate = futureWeekday(2);
    const isoDate = `${leaveDate.getFullYear()}-${String(leaveDate.getMonth() + 1).padStart(2, "0")}-${String(leaveDate.getDate()).padStart(2, "0")}`;

    await prisma.doctorLeave.create({
      data: { doctorId: doctor.id, date: leaveDate, reason: "Test leave" },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto("/en/portal/book");
      await page.getByRole("button", { name: new RegExp(doctor.specialty ?? "General Medicine") }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: new RegExp(doctor.user.name) }).click();
      await page.getByRole("button", { name: "Continue" }).click();

      // The leave day is disabled outright in the calendar — it should never be clickable.
      await expect(await navigateToDate(page, isoDate)).toBeDisabled();

      const created = await prisma.appointment.findFirst({
        where: { doctorId: doctor.id, scheduledAt: toDateStrict(leaveDate, 10, 0) },
      });
      expect(created).toBeNull();
    } finally {
      await prisma.doctorLeave.deleteMany({ where: { doctorId: doctor.id, date: leaveDate } });
    }
  });

  test("the booking wizard only offers times inside a doctor's overridden working hours", async ({
    page,
  }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });
    const bookingDate = futureWeekday(2);
    const isoDate = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, "0")}-${String(bookingDate.getDate()).padStart(2, "0")}`;

    await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: { workStartTime: "09:00", workEndTime: "11:00" },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto("/en/portal/book");
      await page.getByRole("button", { name: new RegExp(doctor.specialty ?? "General Medicine") }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: new RegExp(doctor.user.name) }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await (await navigateToDate(page, isoDate)).click();

      // 2:00 PM is within the clinic's default 9 AM-5 PM hours but outside this doctor's 9-11 AM override.
      await expect(page.getByRole("button", { name: "2:00 PM", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "9:00 AM", exact: true })).toBeVisible();

      const created = await prisma.appointment.findFirst({
        where: { doctorId: doctor.id, scheduledAt: toDateStrict(bookingDate, 14, 0) },
      });
      expect(created).toBeNull();
    } finally {
      await prisma.doctorProfile.update({
        where: { id: doctor.id },
        data: { workStartTime: null, workEndTime: null },
      });
    }
  });

  test("a doctor can manage their own leave days from /staff/my-availability", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });

    try {
      await loginAs(page, "doctor@nca.clinic");
      await page.goto("/en/staff/my-availability");

      const leaveDate = futureWeekday(48);
      const dateInputValue = `${leaveDate.getFullYear()}-${String(leaveDate.getMonth() + 1).padStart(2, "0")}-${String(leaveDate.getDate()).padStart(2, "0")}`;
      await page.fill('input[name="date"]', dateInputValue);
      await page.fill('input[name="reason"]', "Personal day");
      await page.click('button:has-text("Add leave day")');
      await expect(page.getByText("Personal day")).toBeVisible();

      await expect.poll(async () => {
        const row = await prisma.doctorLeave.findUnique({
          where: { doctorId_date: { doctorId: doctor.id, date: leaveDate } },
        });
        return row?.reason ?? null;
      }).toBe("Personal day");

      await page.getByRole("button", { name: "Remove" }).first().click();
      await expect(page.getByText("Personal day")).not.toBeVisible();

      await expect.poll(async () => {
        return prisma.doctorLeave.findUnique({
          where: { doctorId_date: { doctorId: doctor.id, date: leaveDate } },
        });
      }).toBeNull();
    } finally {
      await prisma.doctorLeave.deleteMany({ where: { doctorId: doctor.id } });
    }
  });

  test("the admin-only availability page rejects a doctor visiting it directly", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });

    await loginAs(page, "doctor@nca.clinic");
    await page.goto(`/en/staff/users/${doctor.id}/availability`);
    await page.waitForURL((url) => !url.pathname.includes("/staff/users"));
    expect(page.url()).toContain("/en/staff");
    expect(page.url()).not.toContain("/staff/users");
  });
});

function toDateStrict(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
