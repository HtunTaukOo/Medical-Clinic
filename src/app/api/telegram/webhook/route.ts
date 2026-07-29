import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage, notifyStaff, getStaffTelegramChatId } from "@/lib/telegram";
import { isWithinSelfCheckInWindow, getQueuePosition } from "@/lib/queue";

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    reply_to_message?: { message_id: number };
  };
};

const HELP_TEXT =
  "Sorry, I didn't understand that. Reply CANCEL to cancel an upcoming confirmed appointment, CHECK IN to check in for today's appointment, or CHAT <message> to send a message to the clinic.";

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
  const chatId = message ? String(message.chat.id) : undefined;

  const normalized = text?.trim().toUpperCase().replace(/[\s-]/g, "");

  if (message && text?.startsWith("/start")) {
    const patientId = text.split(" ")[1];

    if (patientId) {
      const patient = await prisma.patient
        .update({
          where: { id: patientId },
          data: { telegramChatId: chatId },
        })
        .catch(() => null);

      if (patient) {
        await sendTelegramMessage(
          chatId!,
          `✅ Telegram connected! You'll receive appointment updates from NCA Clinic here, ${patient.name}.`
        );
      } else {
        await sendTelegramMessage(
          chatId!,
          "This connection link is invalid or expired. Please try again from the patient portal."
        );
      }
    } else {
      await sendTelegramMessage(
        chatId!,
        "Welcome to NCA Clinic. To connect your account, use the link from your patient portal."
      );
    }
  } else if (message?.reply_to_message && (await isReplyInStaffChat(chatId))) {
    await handleStaffReply(message.reply_to_message.message_id, text ?? "");
  } else if (message && normalized === "CANCEL") {
    await handleCancelCommand(chatId!);
  } else if (message && normalized === "CHECKIN") {
    await handleCheckInCommand(chatId!);
  } else if (message && /^chat\s+/i.test(text?.trim() ?? "")) {
    const chatMessage = text!.trim().replace(/^chat\s+/i, "").trim();
    await handleChatCommand(chatId!, chatMessage);
  } else if (message && text) {
    await sendTelegramMessage(chatId!, HELP_TEXT);
  }

  return NextResponse.json({ ok: true });
}

async function isReplyInStaffChat(chatId: string | undefined) {
  if (!chatId) return false;
  const staffChatId = await getStaffTelegramChatId();
  return !!staffChatId && staffChatId === chatId;
}

async function handleStaffReply(repliedToMessageId: number, replyText: string) {
  if (!replyText.trim()) return;

  const relay = await prisma.telegramChatMessage.findUnique({
    where: { staffMessageId: repliedToMessageId },
    include: { patient: true },
  });
  if (!relay || !relay.patient.telegramChatId) return;

  await sendTelegramMessage(
    relay.patient.telegramChatId,
    `💬 <b>Reply from NCA Clinic:</b>\n\n${replyText}`
  );
}

async function handleChatCommand(chatId: string, chatMessage: string) {
  const patient = await prisma.patient.findFirst({ where: { telegramChatId: chatId } });
  if (!patient) {
    await sendTelegramMessage(
      chatId,
      "Please connect your account first from the patient portal before using this."
    );
    return;
  }

  if (!chatMessage) {
    await sendTelegramMessage(chatId, "Please include a message, e.g. CHAT I'll be 10 minutes late.");
    return;
  }

  const staffChatId = await getStaffTelegramChatId();
  if (!staffChatId) {
    await sendTelegramMessage(
      chatId,
      "Sorry, the clinic hasn't set up chat on Telegram yet. Please call the clinic directly."
    );
    return;
  }

  const sent = await sendTelegramMessage(
    staffChatId,
    `💬 <b>${patient.name}</b> says:\n\n${chatMessage}\n\n<i>Reply to this message to respond.</i>`
  );
  if (!sent) {
    await sendTelegramMessage(chatId, "Sorry, your message couldn't be sent right now. Please try again.");
    return;
  }

  await prisma.telegramChatMessage.create({
    data: { staffMessageId: sent.message_id, patientId: patient.id },
  });

  await sendTelegramMessage(chatId, "Your message has been sent to the clinic. We'll reply here soon.");
}

async function handleCheckInCommand(chatId: string) {
  const patient = await prisma.patient.findFirst({ where: { telegramChatId: chatId } });
  if (!patient) {
    await sendTelegramMessage(
      chatId,
      "Please connect your account first from the patient portal before using this."
    );
    return;
  }

  const now = new Date();
  const candidates = await prisma.appointment.findMany({
    where: { patientId: patient.id, status: "CONFIRMED" },
    orderBy: { scheduledAt: "asc" },
    include: { doctor: { include: { user: true } } },
  });
  const eligible = candidates.filter((a) => isWithinSelfCheckInWindow(a.scheduledAt, now));

  if (eligible.length === 0) {
    await sendTelegramMessage(
      chatId,
      "You don't have an appointment ready for check-in right now (check-in opens 30 minutes before your appointment)."
    );
    return;
  }

  if (eligible.length > 1) {
    const list = eligible
      .map((a) => `• ${a.scheduledAt.toLocaleString()} with ${a.doctor.user.name}`)
      .join("\n");
    await sendTelegramMessage(
      chatId,
      `You have more than one appointment ready for check-in:\n${list}\n\nPlease check in from your patient portal so you can pick the right one.`
    );
    return;
  }

  const appointment = eligible[0];
  const checkedInAt = now;
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CHECKED_IN", checkedInAt },
  });

  const position = await getQueuePosition(appointment.doctorId, checkedInAt);
  await sendTelegramMessage(
    chatId,
    `✅ You're checked in with ${appointment.doctor.user.name}. You're #${position} in the queue.`
  );

  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${appointment.id}`);
  revalidatePath("/staff/queue");
  revalidatePath("/portal/appointments");
  revalidatePath("/portal");
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
