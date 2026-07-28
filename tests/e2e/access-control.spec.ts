import bcrypt from "bcryptjs";
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

test.describe("Cross-account access control", () => {
  test("a patient cannot view another patient's appointment", async ({ page }) => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    const otherPatient = await prisma.patient.create({
      data: { name: `Other Patient ${Date.now()}` },
    });
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: otherPatient.id,
        scheduledAt: new Date(),
        status: "COMPLETED",
      },
    });

    try {
      await loginAs(page, "patient@example.com");
      const response = await page.goto(`/en/portal/appointments/${appointment.id}`);
      expect(response?.status()).toBe(404);
    } finally {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      await prisma.patient.delete({ where: { id: otherPatient.id } });
    }
  });

  test("a doctor cannot view another doctor's appointment", async ({ page }) => {
    const passwordHash = await bcrypt.hash("password123", 10);
    const otherDoctorUser = await prisma.user.create({
      data: {
        name: "Other Doctor",
        email: `other-doctor-${Date.now()}@example.com`,
        passwordHash,
        role: "DOCTOR",
        doctorProfile: { create: {} },
      },
      include: { doctorProfile: true },
    });
    const patient = await prisma.patient.create({
      data: { name: `Access Test Patient ${Date.now()}` },
    });
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: otherDoctorUser.doctorProfile!.id,
        patientId: patient.id,
        scheduledAt: new Date(),
        status: "COMPLETED",
      },
    });

    try {
      // doctor@nca.clinic is a different, seeded doctor account.
      await loginAs(page, "doctor@nca.clinic");
      const response = await page.goto(`/en/staff/appointments/${appointment.id}`);
      expect(response?.status()).toBe(404);
    } finally {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      await prisma.patient.delete({ where: { id: patient.id } });
      await prisma.user.delete({ where: { id: otherDoctorUser.id } });
    }
  });
});
