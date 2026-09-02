import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPatient } from "@/lib/telegram";
import { createNotification } from "@/lib/notifications";
import { notifyWaitlistOfOpening } from "@/actions/waitlist";
import { clinicMidnight } from "@/lib/clinic-hours";

// Appointments left CONFIRMED past their day were never checked in — the
// patient didn't show. Appointments still REQUESTED past their day were
// never confirmed by staff at all, so they expire rather than count as a
// no-show. CHECKED_IN appointments are left alone: the patient did show up,
// so an incomplete record there is a clinical documentation gap for staff to
// close, not something safe to auto-resolve.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const todayStart = clinicMidnight(new Date());

  const confirmed = await prisma.appointment.findMany({
    where: { status: "CONFIRMED", scheduledAt: { lt: todayStart } },
    include: { doctor: { include: { user: true } } },
    take: 200,
  });

  for (const appointment of confirmed) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "NO_SHOW" },
    });
    await notifyWaitlistOfOpening(appointment.doctorId, appointment.scheduledAt);
    await notifyPatient(
      appointment.patientId,
      `Your appointment with ${appointment.doctor.user.name} on ${appointment.scheduledAt.toLocaleString()} was marked as a no-show since you weren't checked in.`
    );
    await createNotification({
      patientId: appointment.patientId,
      category: "APPOINTMENT",
      tone: "WARNING",
      title: "Appointment Missed",
      body: `Your appointment with ${appointment.doctor.user.name}${appointment.doctor.specialty ? ` (${appointment.doctor.specialty})` : ""} on ${appointment.scheduledAt.toLocaleDateString()} was marked as a no-show. Book a new appointment if you still need to be seen.`,
      href: "/portal/appointments",
      relatedId: `appt-noshow-${appointment.id}`,
    });
  }

  const expiredRequests = await prisma.appointment.findMany({
    where: { status: "REQUESTED", scheduledAt: { lt: todayStart } },
    include: { doctor: { include: { user: true } } },
    take: 200,
  });

  for (const appointment of expiredRequests) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
    });
    await notifyPatient(
      appointment.patientId,
      `Your appointment request with ${appointment.doctor.user.name} for ${appointment.scheduledAt.toLocaleString()} expired without confirmation and has been cancelled.`
    );
    await createNotification({
      patientId: appointment.patientId,
      category: "APPOINTMENT",
      tone: "WARNING",
      title: "Appointment Request Expired",
      body: `Your appointment request with ${appointment.doctor.user.name} for ${appointment.scheduledAt.toLocaleDateString()} was never confirmed and has expired. Please book again if you still need to be seen.`,
      href: "/portal/appointments",
      relatedId: `appt-expired-${appointment.id}`,
    });
  }

  return NextResponse.json({
    ok: true,
    noShows: confirmed.length,
    expiredRequests: expiredRequests.length,
  });
}