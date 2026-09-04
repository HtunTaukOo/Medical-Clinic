import { Send } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTelegramBotUsername } from "@/lib/telegram";
import { disconnectTelegram } from "@/actions/telegram";
import { Button } from "@/components/ui/button";

export async function TelegramConnectCard() {
  const botUsername = getTelegramBotUsername();
  if (!botUsername) return null;

  const session = await auth();
  const patientId = session?.user.patientId;
  if (!patientId) return null;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { telegramChatId: true },
  });

  const connected = !!patient?.telegramChatId;
  const connectUrl = `https://t.me/${botUsername}?start=${patientId}`;

  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 font-medium">
        <Send className="size-4" />
        Telegram notifications
      </p>
      <div className="flex items-center justify-between gap-4">
        {connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Connected — you&apos;ll get appointment updates here on Telegram.
            </p>
            <form action={disconnectTelegram}>
              <Button size="sm" variant="outline" type="submit">
                Disconnect
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect Telegram to get appointment confirmations and updates instantly.
            </p>
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
