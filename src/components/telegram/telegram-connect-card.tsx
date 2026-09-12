import { Send } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTelegramBotUsername } from "@/lib/telegram";
import { disconnectTelegram } from "@/actions/telegram";
import { Button } from "@/components/ui/button";

const COPY = {
  patient: {
    connected: "Connected — you'll get appointment updates here on Telegram.",
    disconnected: "Connect Telegram to get appointment confirmations and updates instantly.",
  },
  doctor: {
    connected: "Connected — you'll get new appointment, cancellation, and lab-result alerts here on Telegram.",
    disconnected:
      "Connect Telegram to get new appointment, cancellation, and lab-result alerts instantly.",
  },
} as const;

export async function TelegramConnectCard() {
  const botUsername = getTelegramBotUsername();
  if (!botUsername) return null;

  const session = await auth();
  const patientId = session?.user.patientId;
  const doctorId = !patientId ? session?.user.doctorId : undefined;
  if (!patientId && !doctorId) return null;

  const copy = patientId ? COPY.patient : COPY.doctor;
  const connectUrl = patientId
    ? `https://t.me/${botUsername}?start=p_${patientId}`
    : `https://t.me/${botUsername}?start=d_${doctorId}`;

  const connected = patientId
    ? !!(
        await prisma.patient.findUnique({
          where: { id: patientId },
          select: { telegramChatId: true },
        })
      )?.telegramChatId
    : !!(
        await prisma.doctorProfile.findUnique({
          where: { id: doctorId },
          select: { telegramChatId: true },
        })
      )?.telegramChatId;

  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 font-medium">
        <Send className="size-4" />
        Telegram notifications
      </p>
      <div className="flex items-center justify-between gap-4">
        {connected ? (
          <>
            <p className="text-sm text-muted-foreground">{copy.connected}</p>
            <form action={disconnectTelegram}>
              <Button size="sm" variant="outline" type="submit">
                Disconnect
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{copy.disconnected}</p>
            <Button asChild size="sm">
              <a href={connectUrl} target="_blank" rel="noopener noreferrer">
                Connect
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
