import fs from "node:fs";
import path from "node:path";
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { prisma } from "./db";

const WEBHOOK_URL = "http://localhost:3000/api/telegram/webhook";

function readEnvVar(name: string): string | undefined {
  const envPath = path.resolve(__dirname, "../../.env");
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match?.[1]?.trim().replace(/^"|"$/g, "");
}

const WEBHOOK_SECRET = readEnvVar("TELEGRAM_WEBHOOK_SECRET");

async function postWebhook(body: unknown) {
  const context = await playwrightRequest.newContext();
  const response = await context.post(WEBHOOK_URL, {
    data: body,
    headers: WEBHOOK_SECRET ? { "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET } : {},
  });
  await context.dispose();
  return response;
}

test.describe("Telegram bot commands", () => {
  test("CHECK IN checks the patient's appointment in", async () => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const fakeChatId = "111222333";

    await prisma.patient.update({
      where: { id: patient.id },
      data: { telegramChatId: fakeChatId },
    });
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt: new Date(),
        status: "CONFIRMED",
      },
    });

    try {
      const response = await postWebhook({
        message: { message_id: 1, text: "CHECK IN", chat: { id: Number(fakeChatId) } },
      });
      expect(response.status()).toBe(200);

      const updated = await prisma.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
      });
      expect(updated.status).toBe("CHECKED_IN");
      expect(updated.checkedInAt).not.toBeNull();
    } finally {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      await prisma.patient.update({
        where: { id: patient.id },
        data: { telegramChatId: null },
      });
    }
  });

  test("CHECK IN outside the self-check-in window does nothing", async () => {
    const doctor = await prisma.doctorProfile.findFirstOrThrow();
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const fakeChatId = "111222334";

    await prisma.patient.update({
      where: { id: patient.id },
      data: { telegramChatId: fakeChatId },
    });
    const farFuture = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt: farFuture,
        status: "CONFIRMED",
      },
    });

    try {
      const response = await postWebhook({
        message: { message_id: 2, text: "CHECK IN", chat: { id: Number(fakeChatId) } },
      });
      expect(response.status()).toBe(200);

      const unchanged = await prisma.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
      });
      expect(unchanged.status).toBe("CONFIRMED");
    } finally {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      await prisma.patient.update({
        where: { id: patient.id },
        data: { telegramChatId: null },
      });
    }
  });

  test("CHAT without a configured staff chat does not create a relay record", async () => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const fakeChatId = "111222335";
    const settings = await prisma.clinicSettings.findFirstOrThrow();

    await prisma.patient.update({
      where: { id: patient.id },
      data: { telegramChatId: fakeChatId },
    });
    await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: { staffTelegramChatId: null },
    });

    try {
      const response = await postWebhook({
        message: { message_id: 3, text: "CHAT Hello, I have a question", chat: { id: Number(fakeChatId) } },
      });
      expect(response.status()).toBe(200);

      const relayCount = await prisma.telegramChatMessage.count({ where: { patientId: patient.id } });
      expect(relayCount).toBe(0);
    } finally {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { telegramChatId: null },
      });
    }
  });

  test("CHAT with a staff chat Telegram rejects does not create a relay record", async () => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    const fakeChatId = "111222336";
    const settings = await prisma.clinicSettings.findFirstOrThrow();

    await prisma.patient.update({
      where: { id: patient.id },
      data: { telegramChatId: fakeChatId },
    });
    await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: { staffTelegramChatId: "1" },
    });

    try {
      const response = await postWebhook({
        message: { message_id: 4, text: "CHAT I'll be 10 minutes late", chat: { id: Number(fakeChatId) } },
      });
      expect(response.status()).toBe(200);

      const relayCount = await prisma.telegramChatMessage.count({ where: { patientId: patient.id } });
      expect(relayCount).toBe(0);
    } finally {
      await prisma.clinicSettings.update({
        where: { id: settings.id },
        data: { staffTelegramChatId: null },
      });
      await prisma.patient.update({
        where: { id: patient.id },
        data: { telegramChatId: null },
      });
    }
  });

  test("a staff reply to an unknown message id is a no-op", async () => {
    const settings = await prisma.clinicSettings.findFirstOrThrow();
    await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: { staffTelegramChatId: "222333444" },
    });

    try {
      const response = await postWebhook({
        message: {
          message_id: 5,
          text: "Sure thing!",
          chat: { id: 222333444 },
          reply_to_message: { message_id: 999999 },
        },
      });
      expect(response.status()).toBe(200);
    } finally {
      await prisma.clinicSettings.update({
        where: { id: settings.id },
        data: { staffTelegramChatId: null },
      });
    }
  });
});
