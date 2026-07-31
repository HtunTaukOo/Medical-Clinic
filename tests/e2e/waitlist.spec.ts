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

test.describe("Waitlist", () => {
  test("a patient can join a waitlist on conflict, leave it, and gets notified when the slot frees up", async ({
    page,
  }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const scheduledAt = futureWeekdayAt(60, 10, 0);
    // The requested time is within the 30-minute conflict window of the existing appointment.
    const requestedAt = new Date(scheduledAt.getTime() + 10 * 60 * 1000);

    const occupyingAppointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: (await prisma.patient.findFirstOrThrow({ where: { email: "patient@example.com" } })).id,
        scheduledAt,
        status: "CONFIRMED",
      },
    });

    try {
      await loginAs(page, "patient@example.com");
      await page.goto(`/en/portal/appointments/new?doctorId=${doctor.id}`);
      await page.fill('input[name="scheduledAt"]', toDatetimeLocal(requestedAt));
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/already has an appointment within/i)).toBeVisible();
      await page.click('button:has-text("Join waitlist for this time")');
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/on the waitlist/i)).toBeVisible();

      const entry = await prisma.waitlist.findFirstOrThrow({
        where: { doctorId: doctor.id, requestedAt },
      });
      expect(entry.status).toBe("WAITING");

      // Leave and rejoin so we can test the notification path cleanly.
      await page.goto("/en/portal/appointments");
      await expect(page.getByText("Waiting")).toBeVisible();
      await page.click('button:has-text("Leave waitlist")');
      await expect.poll(async () => prisma.waitlist.findUnique({ where: { id: entry.id } })).toBeNull();

      const secondEntry = await prisma.waitlist.create({
        data: { doctorId: doctor.id, patientId: entry.patientId, requestedAt },
      });

      // Cancelling the occupying appointment through the real action should notify the waitlist.
      await loginAs(page, "receptionist@nca.clinic");
      await page.goto(`/en/staff/appointments/${occupyingAppointment.id}`);
      await page.click('button:has-text("Cancel")');
      await page.waitForLoadState("networkidle");

      await expect.poll(async () => {
        const updated = await prisma.waitlist.findUniqueOrThrow({ where: { id: secondEntry.id } });
        return updated.status;
      }).toBe("NOTIFIED");
    } finally {
      await prisma.waitlist.deleteMany({ where: { doctorId: doctor.id, requestedAt } });
      await prisma.appointment.deleteMany({ where: { id: occupyingAppointment.id } });
    }
  });
});
