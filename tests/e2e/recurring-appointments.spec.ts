import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

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
  return { year, month, day };
}

// Reverses the block picker's "8:00 AM – 10:00 AM · 0/10 booked" display
// format back to a 24h start time.
function parseBlockStartLabel(label: string) {
  const m = label.match(/^(\d{1,2}):(\d{2}) (AM|PM)/);
  if (!m) throw new Error(`Unrecognized block label: ${label}`);
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  if (m[3] === "AM" && hh === 12) hh = 0;
  if (m[3] === "PM" && hh !== 12) hh += 12;
  return { hh, mm };
}

const CLINIC_UTC_OFFSET_MINUTES = 6 * 60 + 30;
function clinicMidnightForYMD(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - CLINIC_UTC_OFFSET_MINUTES * 60 * 1000);
}

test.describe("Recurring appointments (staff only)", () => {
  test("staff can book a weekly recurring series", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const { year, month, day } = futureWeekday(90);
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const start = clinicMidnightForYMD(year, month, day);
    const rangeEnd = new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000);

    try {
      await loginAs(page, "receptionist@nca.clinic");
      await page.goto("/en/staff/appointments/new");

      await page.locator("#patientId").click();
      await page.getByRole("option", { name: patient.name }).click();
      await page.locator("#doctorId").click();
      await page.getByRole("option").first().click();
      await page.fill("#block-picker-date", isoDate);
      await page.locator("button:not([disabled])").filter({ hasText: /–/ }).first().click();
      await page.check('input[name="repeatWeekly"]');
      await page.fill("#occurrences", "3");
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/Booked 3 weekly appointments/i)).toBeVisible();

      const created = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: { gte: start, lte: rangeEnd },
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
      expect([120, 180]).toContain(created[0].durationMinutes);

      await prisma.appointment.deleteMany({ where: { id: { in: created.map((c) => c.id) } } });
    } finally {
      await prisma.appointment.deleteMany({
        where: { doctorId: doctor.id, patientId: patient.id, scheduledAt: { gte: start, lte: rangeEnd } },
      });
    }
  });

  test("a conflicting occurrence in the series is skipped, not fatal", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
    });
    const specialty = await prisma.specialty.findUniqueOrThrow({ where: { name: doctor.specialty! } });
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const { year, month, day } = futureWeekday(100);
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const start = clinicMidnightForYMD(year, month, day);
    const rangeEnd = new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000);

    const fillerIds: string[] = [];

    try {
      await loginAs(page, "receptionist@nca.clinic");
      await page.goto("/en/staff/appointments/new");

      await page.locator("#patientId").click();
      await page.getByRole("option", { name: patient.name }).click();
      await page.locator("#doctorId").click();
      await page.getByRole("option").first().click();
      await page.fill("#block-picker-date", isoDate);

      const firstBlock = page.locator("button:not([disabled])").filter({ hasText: /–/ }).first();
      const label = (await firstBlock.textContent())!;
      const { hh, mm } = parseBlockStartLabel(label);
      await firstBlock.click();

      // Fill week 2's same block to capacity across other doctors of the
      // specialty, so that specific occurrence hits a real capacity conflict
      // when the recurring series tries to book it.
      const secondOccurrence = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 + (hh * 60 + mm) * 60 * 1000);
      for (let i = 0; i < specialty.capacityPerSlot; i++) {
        const filler = await prisma.patient.create({
          data: { name: `Recurring Filler ${i}`, patientCode: `RECFILL-${Date.now()}-${i}` },
        });
        const appt = await prisma.appointment.create({
          data: { doctorId: doctor.id, patientId: filler.id, scheduledAt: secondOccurrence, status: "CONFIRMED" },
        });
        fillerIds.push(appt.id);
      }

      await page.check('input[name="repeatWeekly"]');
      await page.fill("#occurrences", "3");
      await page.click('button:has-text("New appointment")');

      await expect(page.getByText(/Booked 2 weekly appointments/i)).toBeVisible();
      await expect(page.getByText(/Skipped/i)).toBeVisible();

      const created = await prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: { gte: start, lte: rangeEnd },
        },
      });
      expect(created).toBe(2);
    } finally {
      await prisma.appointment.deleteMany({
        where: { doctorId: doctor.id, patientId: patient.id, scheduledAt: { gte: start, lte: rangeEnd } },
      });
      await prisma.appointment.deleteMany({ where: { id: { in: fillerIds } } });
      await prisma.patient.deleteMany({ where: { name: { startsWith: "Recurring Filler " } } });
    }
  });
});
