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

// Reverses the wizard's "9:00 AM" / "11:30 PM" display format back to 24h.
function parseTimeLabel(label: string) {
  const m = label.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m) throw new Error(`Unrecognized time label: ${label}`);
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  if (m[3] === "AM") {
    if (hh === 12) hh = 0;
  } else if (hh !== 12) {
    hh += 12;
  }
  return { hh, mm };
}

test.describe("Waitlist", () => {
  test("a patient can join a waitlist on conflict, leave it, and gets notified when the slot frees up", async ({
    page,
  }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow({
      where: { user: { email: "doctor@nca.clinic" } },
      include: { user: true },
    });
    // A small, in-window offset (the wizard's calendar starts on the current month).
    const { year, month, day } = futureWeekday(3);
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    await loginAs(page, "patient@example.com");
    await page.goto("/en/portal/book");
    await page.getByRole("button", { name: new RegExp(doctor.specialty ?? "General Medicine") }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: new RegExp(doctor.user.name) }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await (await navigateToDate(page, isoDate)).click();

    const firstSlot = page.locator("button:not([disabled])").filter({ hasText: /(AM|PM)/ }).first();
    await expect(firstSlot).toBeVisible();
    const label = (await firstSlot.textContent())!.trim();
    const { hh, mm } = parseTimeLabel(label);
    const scheduledAt = new Date(clinicMidnightForYMD(year, month, day).getTime() + (hh * 60 + mm) * 60 * 1000);
    const requestedAt = scheduledAt;

    // Simulate a race: another booking lands on this exact slot after we fetched
    // availability but before we confirm, so our confirm hits the real conflict path.
    const occupyingAppointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: (await prisma.patient.findFirstOrThrow({ where: { email: "patient@example.com" } })).id,
        scheduledAt,
        status: "CONFIRMED",
      },
    });

    try {
      await firstSlot.click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Routine Check-up" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Confirm Booking" }).click();

      await expect(page.getByText(/that time was just taken/i)).toBeVisible();
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
