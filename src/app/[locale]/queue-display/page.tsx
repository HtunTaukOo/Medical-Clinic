import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { todayRange } from "@/lib/queue";
import { AutoRefresh } from "@/components/queue/auto-refresh";

export default async function QueueDisplayPage() {
  const t = await getTranslations("queueDisplay");
  const { start, end } = todayRange();

  const [calling, waiting] = await Promise.all([
    prisma.walkIn.findMany({
      where: { createdAt: { gte: start, lt: end }, status: "CALLED" },
      orderBy: { calledAt: "desc" },
      take: 5,
    }),
    prisma.walkIn.findMany({
      where: { createdAt: { gte: start, lt: end }, status: "WAITING" },
      orderBy: { tokenNumber: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-8 text-center">
      <AutoRefresh intervalMs={10000} />
      <h1 className="text-3xl font-semibold text-muted-foreground">{t("title")}</h1>

      <div className="grid gap-3">
        <p className="text-lg font-medium text-muted-foreground">{t("nowServing")}</p>
        {calling.length === 0 ? (
          <p className="text-2xl text-muted-foreground">{t("noneCalled")}</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {calling.map((w) => (
              <span
                key={w.id}
                className="rounded-2xl bg-primary px-8 py-4 text-6xl font-bold text-primary-foreground"
              >
                {w.tokenNumber}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <p className="text-lg font-medium text-muted-foreground">{t("waiting")}</p>
        {waiting.length === 0 ? (
          <p className="text-muted-foreground">{t("noneWaiting")}</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {waiting.map((w) => (
              <span key={w.id} className="rounded-xl border px-5 py-2 text-2xl font-semibold">
                {w.tokenNumber}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
