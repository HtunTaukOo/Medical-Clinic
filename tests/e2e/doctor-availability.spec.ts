import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

function futureWeekday(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDatetimeLocal(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  test("a patient cannot book an appointment on a doctor's leave day", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const leaveDate = futureWeekday(46);

    await prisma.doctorLeave.create({
      data: { doctorId: doctor.id, date: leaveDate, reason: "Test leave" },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto(`/en/portal/appointments/new?doctorId=${doctor.id}`);
      await page.fill('input[name="scheduledAt"]', toDatetimeLocal(leaveDate, 10, 0));
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/unavailable on the selected date/i)).toBeVisible();

      const created = await prisma.appointment.findFirst({
        where: { doctorId: doctor.id, scheduledAt: toDateStrict(leaveDate, 10, 0) },
      });
      expect(created).toBeNull();
    } finally {
      await prisma.doctorLeave.deleteMany({ where: { doctorId: doctor.id, date: leaveDate } });
    }
  });

  test("a patient cannot book outside a doctor's overridden working hours", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const bookingDate = futureWeekday(47);

    await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: { workStartTime: "09:00", workEndTime: "11:00" },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto(`/en/portal/appointments/new?doctorId=${doctor.id}`);
      // 14:00 is within the clinic's default 09:00-17:00 hours but outside this doctor's 09:00-11:00 override.
      await page.fill('input[name="scheduledAt"]', toDatetimeLocal(bookingDate, 14, 0));
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/for this doctor/i)).toBeVisible();

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
});

function toDateStrict(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
