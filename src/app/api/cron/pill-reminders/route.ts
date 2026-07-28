import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPatient } from "@/lib/telegram";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const due = await prisma.pillReminder.findMany({
    where: { sent: false, scheduledFor: { lte: new Date() } },
    include: { prescriptionItem: { include: { medicine: true } } },
    take: 200,
  });

  for (const reminder of due) {
    const item = reminder.prescriptionItem;
    await notifyPatient(
      reminder.patientId,
      `💊 Time to take your medicine: ${item.medicine.name} — ${item.dosage}.`
    );
    await prisma.pillReminder.update({
      where: { id: reminder.id },
      data: { sent: true, sentAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, sent: due.length });
}
