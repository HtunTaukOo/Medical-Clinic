import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyStaff } from "@/lib/telegram";
import { EXPIRY_WARNING_DAYS } from "@/lib/inventory";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const now = new Date();
  const warningCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  const medicines = await prisma.medicine.findMany({
    where: { expiryDate: { not: null, lte: warningCutoff } },
    orderBy: { expiryDate: "asc" },
  });

  if (medicines.length > 0) {
    const lines = medicines.map((m) => {
      const label = m.expiryDate! <= now ? "EXPIRED" : "expiring soon";
      return `- ${m.name}: ${label} (${m.expiryDate!.toLocaleDateString()})`;
    });
    await notifyStaff(`⚠️ Medicine expiry alert:\n${lines.join("\n")}`);
  }

  return NextResponse.json({ ok: true, flagged: medicines.length });
}
