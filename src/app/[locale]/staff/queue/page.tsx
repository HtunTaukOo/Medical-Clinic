import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import {
  checkInAppointment,
  completeAppointment,
  cancelAppointment,
} from "@/actions/appointments";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QueuePage() {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("appointments");
  const tNav = await getTranslations("nav");
  const { start, end } = todayRange();

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lt: end },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      doctorId: session.user.role === "DOCTOR" ? session.user.doctorId : undefined,
    },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  const waiting = appointments
    .filter((a) => a.status === "CONFIRMED")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const inQueue = appointments
    .filter((a) => a.status === "CHECKED_IN")
    .sort(
      (a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0)
    );

  const showDoctorColumn = session.user.role !== "DOCTOR";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{tNav("queue")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("waitingToCheckIn")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {waiting.length === 0 && (
            <p className="text-muted-foreground">{t("noneWaiting")}</p>
          )}
          {waiting.map((appt) => (
            <div
              key={appt.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <Link href={`/staff/patients/${appt.patientId}`} className="font-medium underline">
                  {appt.patient.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {new Date(appt.scheduledAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {showDoctorColumn && ` — ${appt.doctor.user.name}`}
                </p>
              </div>
              {session.user.role !== "DOCTOR" && (
                <form action={checkInAppointment.bind(null, appt.id)}>
                  <Button size="sm" type="submit">
                    {t("checkIn")}
                  </Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("inQueue")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {inQueue.length === 0 && (
            <p className="text-muted-foreground">{t("queueEmpty")}</p>
          )}
          {inQueue.map((appt, index) => (
            <div
              key={appt.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-base">
                  #{index + 1}
                </Badge>
                <div>
                  <Link href={`/staff/patients/${appt.patientId}`} className="font-medium underline">
                    {appt.patient.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {appt.checkedInAt &&
                      t("checkedInAt", {
                        time: appt.checkedInAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })}
                    {showDoctorColumn && ` — ${appt.doctor.user.name}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <form action={completeAppointment.bind(null, appt.id)}>
                  <Button size="sm" type="submit">
                    {t("complete")}
                  </Button>
                </form>
                <form action={cancelAppointment.bind(null, appt.id)}>
                  <Button size="sm" variant="destructive" type="submit">
                    {t("cancel")}
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
