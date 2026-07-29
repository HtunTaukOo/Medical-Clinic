import { prisma } from "@/lib/prisma";
import { CLINIC_SETTINGS_ID } from "@/lib/clinic-hours";

const TELEGRAM_API = "https://api.telegram.org/bot";

export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<{ message_id: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error("Telegram sendMessage failed", await res.text());
      return null;
    }
    const body = await res.json();
    return body.result ?? null;
  } catch (err) {
    console.error("Telegram sendMessage error", err);
    return null;
  }
}

export async function notifyPatient(patientId: string, text: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { telegramChatId: true },
  });
  if (patient?.telegramChatId) {
    await sendTelegramMessage(patient.telegramChatId, text);
  }
}

export async function getStaffTelegramChatId() {
  const settings = await prisma.clinicSettings.findUnique({
    where: { id: CLINIC_SETTINGS_ID },
    select: { staffTelegramChatId: true },
  });
  return settings?.staffTelegramChatId ?? null;
}

export async function notifyStaff(text: string) {
  const chatId = await getStaffTelegramChatId();
  if (chatId) {
    await sendTelegramMessage(chatId, text);
  }
}

export async function notifyIfLowStock(medicineId: string) {
  const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
  if (medicine && medicine.stockQty <= medicine.reorderLevel) {
    await notifyStaff(
      `⚠️ Low stock: ${medicine.name} is at ${medicine.stockQty} ${medicine.unit} (reorder level ${medicine.reorderLevel}).`
    );
  }
}
