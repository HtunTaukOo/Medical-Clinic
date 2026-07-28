import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, notifyStaff } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat: { id: number };
  };
};

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const update: TelegramUpdate = await req.json();
  const message = update.message;
  const text = message?.text;

  if (message && text?.startsWith("/start")) {
    const patientId = text.split(" ")[1];
    const chatId = String(message.chat.id);

    if (patientId) {
      const patient = await prisma.patient
        .update({
          where: { id: patientId },
          data: { telegramChatId: chatId },
        })
        .catch(() => null);

      if (patient) {
        await sendTelegramMessage(
          chatId,
          `✅ Telegram connected! You'll receive appointment updates from NCA Clinic here, ${patient.name}.`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          "This connection link is invalid or expired. Please try again from the patient portal."
        );
      }
    } else {
      await sendTelegramMessage(
        chatId,
        "Welcome to NCA Clinic. To connect your account, use the link from your patient portal."
      );
    }
  } else if (message && text?.trim().toUpperCase() === "CANCEL") {
    await handleCancelCommand(String(message.chat.id));
  } else if (message && text) {
    await sendTelegramMessage(
      String(message.chat.id),
      "Sorry, I didn't understand that. Reply CANCEL to cancel an upcoming confirmed appointment."
    );
  }

  return NextResponse.json({ ok: true });
}

async function handleCancelCommand(chatId: string) {
  const patient = await prisma.patient.findFirst({ where: { telegramChatId: chatId } });
  if (!patient) {
    await sendTelegramMessage(
      chatId,
      "Please connect your account first from the patient portal before using this."
    );
    return;
  }

  const upcoming = await prisma.appointment.findMany({
    where: { patientId: patient.id, status: "CONFIRMED", scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    include: { doctor: { include: { user: true } } },
  });

  if (upcoming.length === 0) {
    await sendTelegramMessage(chatId, "You have no upcoming confirmed appointments to cancel.");
    return;
  }

  if (upcoming.length > 1) {
    const list = upcoming
      .map((a) => `• ${a.scheduledAt.toLocaleString()} with ${a.doctor.user.name}`)
      .join("\n");
    await sendTelegramMessage(
      chatId,
      `You have more than one upcoming appointment:\n${list}\n\nPlease cancel from your patient portal so you can pick the right one.`
    );
    return;
  }

  const appointment = upcoming[0];
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED" },
  });

  await sendTelegramMessage(
    chatId,
    `❌ Your appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} has been cancelled.`
  );
  await notifyStaff(
    `❌ ${patient.name} cancelled their appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} via Telegram.`
  );

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointment.id}`);
  revalidatePath("/staff/queue");
  revalidatePath("/portal/appointments");
}
