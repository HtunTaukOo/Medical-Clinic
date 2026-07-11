import { CalendarCheck2, CalendarClock, Receipt, HeartPulse } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HeroBanner } from "@/components/hero-banner";
import { StatTile } from "@/components/stat-tile";
import { ClinicStatusBanner } from "@/components/clinic/clinic-status-banner";
import { getDisplayFirstName } from "@/lib/format";
import { getQueuePosition, isWithinSelfCheckInWindow } from "@/lib/queue";
import { checkInAppointment } from "@/actions/appointments";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function PortalDashboardPage() {
  const session = await auth();
  const t = await getTranslations();
  const patientId = session?.user.patientId;

  const [totalAppointments, upcomingAppointments, outstandingInvoices] =
    await Promise.all([
      patientId ? prisma.appointment.count({ where: { patientId } }) : 0,
      patientId
        ? prisma.appointment.findMany({
            where: {
              patientId,
              OR: [
                { scheduledAt: { gte: new Date() }, status: { in: ["REQUESTED", "CONFIRMED"] } },
                { status: "CHECKED_IN" },
              ],
            },
            orderBy: { scheduledAt: "asc" },
            take: 3,
            include: { doctor: { include: { user: true } } },
          })
        : [],
      patientId
        ? prisma.invoice.count({
            where: { patientId, status: { in: ["UNPAID", "PARTIAL"] } },
          })
        : 0,
    ]);

  const firstName = session?.user.name ? getDisplayFirstName(session.user.name) : "";

  return (
    <div className="grid gap-6">
      <ClinicStatusBanner />
      <HeroBanner
        name={firstName}
        subtitle={`${upcomingAppointments.length} upcoming appointment${upcomingAppointments.length === 1 ? "" : "s"} scheduled`}
        icon={HeartPulse}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/portal/appointments/new">{t("appointments.requestNew")}</Link>
            </Button>
            <Button asChild variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
              <Link href="/portal/invoices">{t("nav.myInvoices")}</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={CalendarCheck2} value={totalAppointments} label="Total Visits" color="emerald" />
        <StatTile
          icon={CalendarClock}
          value={upcomingAppointments.length}
          label="Upcoming"
          color="blue"
        />
        <StatTile
          icon={Receipt}
          value={outstandingInvoices}
          label={t("nav.myInvoices")}
          color="purple"
        />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{t("nav.myAppointments")}</CardTitle>
          <Link href="/portal/appointments" className="text-sm underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3">
          {upcomingAppointments.length === 0 && (
            <p className="text-muted-foreground">{t("appointments.noResults")}</p>
          )}
          {await Promise.all(
            upcomingAppointments.map(async (appt) => {
              const position =
                appt.status === "CHECKED_IN" && appt.checkedInAt
                  ? await getQueuePosition(appt.doctorId, appt.checkedInAt)
                  : undefined;
              const canSelfCheckIn =
                appt.status === "CONFIRMED" && isWithinSelfCheckInWindow(appt.scheduledAt);
              return (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {initials(appt.doctor.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{appt.doctor.user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {appt.doctor.specialty ?? "General Practice"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {position !== undefined ? (
                      <p className="text-sm font-medium text-primary">
                        {t("appointments.queuePosition", {
                          position,
                          doctor: appt.doctor.user.name,
                        })}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {new Date(appt.scheduledAt).toLocaleString()}
                      </p>
                    )}
                    {canSelfCheckIn && (
                      <form action={checkInAppointment.bind(null, appt.id)} className="mt-1">
                        <Button size="sm" type="submit">
                          {t("appointments.checkIn")}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
