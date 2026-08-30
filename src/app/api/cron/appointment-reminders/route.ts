import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPatient } from "@/lib/telegram";
import { createNotification } from "@/lib/notifications";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const due = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      scheduledAt: { gte: now, lte: windowEnd },
    },
    include: { doctor: { include: { user: true } } },
    take: 200,
  });

  for (const appointment of due) {
    await notifyPatient(
      appointment.patientId,
      `📅 Reminder: you have an appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()}.\n\nReply CANCEL to cancel it.`
    );
    await createNotification({
      patientId: appointment.patientId,
      category: "APPOINTMENT",
      tone: "INFO",
      title: "Appointment Tomorrow",
      body: `Reminder: You have an appointment with ${appointment.doctor.user.name}${appointment.doctor.specialty ? ` (${appointment.doctor.specialty})` : ""} tomorrow at ${appointment.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Please arrive 10 minutes early.`,
      href: `/portal/appointments/${appointment.id}`,
      relatedId: `appt-reminder-${appointment.id}`,
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSent: true },
    });
  }

  return NextResponse.json({ ok: true, sent: due.length });
}
