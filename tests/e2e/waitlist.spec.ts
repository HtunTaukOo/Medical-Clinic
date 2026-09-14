import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

// Matches CLINIC_UTC_OFFSET_MINUTES in src/lib/clinic-hours.ts (Asia/Yangon, fixed, no DST).
const CLINIC_UTC_OFFSET_MINUTES = 6 * 60 + 30;

function clinicMidnightForYMD(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - CLINIC_UTC_OFFSET_MINUTES * 60 * 1000);
}

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

test.describe("Waitlist", () => {
  test("a patient can join a waitlist on a full block, leave it, and gets notified when a spot frees up", async ({
    page,
  }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });
    const specialty = await prisma.specialty.findUniqueOrThrow({ where: { name: doctor.specialty! } });
    const { year, month, day } = futureWeekday(3);
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayStart = clinicMidnightForYMD(year, month, day);
    const scheduledAt = new Date(dayStart.getTime() + 8 * 60 * 60 * 1000); // block1, 08:00

    // Fill the pooled-capacity block so the patient's own booking hits a real conflict.
    const fillerIds: string[] = [];
    for (let i = 0; i < specialty.capacityPerSlot; i++) {
      const filler = await prisma.patient.create({
        data: { name: `Waitlist Filler ${i}`, patientCode: `WLFILL-${Date.now()}-${i}` },
      });
      const appt = await prisma.appointment.create({
        data: { doctorId: doctor.id, patientId: filler.id, scheduledAt, status: "CONFIRMED" },
      });
      fillerIds.push(appt.id);
    }
    try {
      await loginAs(page, "patient@example.com");
      await page.goto("/en/portal/book");
      await page.getByRole("button", { name: new RegExp(doctor.specialty!) }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await (await navigateToDate(page, isoDate)).click();

      const block1 = page.getByRole("button", { name: /8:00 AM.*Full/ });
      await expect(block1).toBeVisible();
      await expect(block1).toBeDisabled();

      // Pick a different (open) block instead, then race a fill against it so
      // the real confirm path hits the conflict branch server-side.
      const openBlock = page.locator("button:not([disabled])").filter({ hasText: /–/ }).first();
      const openBlockLabel = (await openBlock.textContent())!;
      const m = openBlockLabel.match(/^(\d{1,2}):(\d{2}) (AM|PM)/);
      if (!m) throw new Error(`Unrecognized block label: ${openBlockLabel}`);
      let hh = Number(m[1]);
      if (m[3] === "PM" && hh !== 12) hh += 12;
      if (m[3] === "AM" && hh === 12) hh = 0;
      const openScheduledAt = new Date(dayStart.getTime() + (hh * 60 + Number(m[2])) * 60 * 1000);

      const raceFillerIds: string[] = [];
      for (let i = 0; i < specialty.capacityPerSlot; i++) {
        const filler = await prisma.patient.create({
          data: { name: `Waitlist Race Filler ${i}`, patientCode: `WLRACE-${Date.now()}-${i}` },
        });
        const appt = await prisma.appointment.create({
          data: { doctorId: doctor.id, patientId: filler.id, scheduledAt: openScheduledAt, status: "CONFIRMED" },
        });
        raceFillerIds.push(appt.id);
      }
      fillerIds.push(...raceFillerIds);
      const occupyingAppointment = await prisma.appointment.findUniqueOrThrow({
        where: { id: raceFillerIds[0] },
      });

      await openBlock.click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: new RegExp(doctor.user.name) }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Routine Check-up" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Confirm Booking" }).click();

      await expect(page.getByText(/just filled up/i)).toBeVisible();
      await page.click('button:has-text("Join waitlist for this time")');
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/on the waitlist/i)).toBeVisible();

      const entry = await prisma.waitlist.findFirstOrThrow({
        where: {
          specialtyName: specialty.name,
          patientId: (await prisma.patient.findFirstOrThrow({ where: { email: "patient@example.com" } })).id,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(entry.status).toBe("WAITING");

      // Leave and rejoin so we can test the notification path cleanly.
      await page.goto("/en/portal/appointments");
      await expect(page.getByText("Waiting")).toBeVisible();
      await page.click('button:has-text("Leave waitlist")');
      await expect.poll(async () => prisma.waitlist.findUnique({ where: { id: entry.id } })).toBeNull();

      const secondEntry = await prisma.waitlist.create({
        data: {
          patientId: entry.patientId,
          specialtyName: entry.specialtyName,
          requestedDate: entry.requestedDate,
          blockId: entry.blockId,
        },
      });

      // Cancelling one of the occupying appointments through the real action
      // should notify the waitlist that the block has room again.
      await loginAs(page, "receptionist@nca.clinic");
      await page.goto(`/en/staff/appointments/${occupyingAppointment.id}`);
      await page.click('button:has-text("Cancel")');
      await page.waitForLoadState("networkidle");

      await expect.poll(async () => {
        const updated = await prisma.waitlist.findUniqueOrThrow({ where: { id: secondEntry.id } });
        return updated.status;
      }).toBe("NOTIFIED");
    } finally {
      await prisma.waitlist.deleteMany({ where: { specialtyName: specialty.name } });
      await prisma.appointment.deleteMany({ where: { id: { in: fillerIds } } });
      await prisma.patient.deleteMany({
        where: { OR: [{ name: { startsWith: "Waitlist Filler " } }, { name: { startsWith: "Waitlist Race Filler " } }] },
      });
    }
  });
});
