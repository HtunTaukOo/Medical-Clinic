import { Clock, ListOrdered, Megaphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import { estimateWaitMinutes } from "@/lib/walk-ins";
import {
  checkInAppointment,
  completeAppointment,
  cancelAppointment,
  markNoShow,
} from "@/actions/appointments";
import { callWalkIn, cancelWalkIn } from "@/actions/walk-ins";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { WalkInForm } from "@/components/queue/walk-in-form";

export default async function QueuePage() {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
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
  const canManageWalkIns = session.user.role !== "DOCTOR";

  const [walkIns, doctors] = await Promise.all([
    canManageWalkIns
      ? prisma.walkIn.findMany({
          where: { createdAt: { gte: start, lt: end }, status: { in: ["WAITING", "CALLED"] } },
          include: { doctor: { include: { user: true } } },
          orderBy: { tokenNumber: "asc" },
        })
      : Promise.resolve([]),
    canManageWalkIns
      ? prisma.doctorProfile.findMany({ include: { user: true } })
      : Promise.resolve([]),
  ]);
  const waitingWalkIns = walkIns.filter((w) => w.status === "WAITING");
  const calledWalkIns = walkIns.filter((w) => w.status === "CALLED");

  // Scheduled patients and walk-ins are fundamentally different (a booked
  // time vs. an arrival token) but staff experience them as one waiting
  // room, so — for roles that see both — merge them into a single list
  // ordered by whichever moment put each person in line.
  type WaitingRow =
    | { kind: "appointment"; appointment: (typeof waiting)[number]; sortKey: number }
    | { kind: "walkin"; walkIn: (typeof waitingWalkIns)[number]; sortKey: number };

  const mergedWaiting: WaitingRow[] = canManageWalkIns
    ? [
        ...waiting.map(
          (appointment): WaitingRow => ({
            kind: "appointment",
            appointment,
            sortKey: appointment.scheduledAt.getTime(),
          })
        ),
        ...waitingWalkIns.map(
          (walkIn): WaitingRow => ({
            kind: "walkin",
            walkIn,
            sortKey: walkIn.createdAt.getTime(),
          })
        ),
      ].sort((a, b) => a.sortKey - b.sortKey)
    : waiting.map((appointment) => ({ kind: "appointment", appointment, sortKey: 0 }));

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{tNav("queue")}</h1>
        {canManageWalkIns && (
          <Button asChild variant="outline">
            <Link href="/queue-display" target="_blank">
              <Megaphone className="size-4" />
              {t("queueDisplay")}
            </Link>
          </Button>
        )}
      </div>

      {canManageWalkIns && (
        <Card>
          <CardHeader>
            <CardTitle>{t("registerWalkIn")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WalkInForm doctors={doctors.map((d) => ({ id: d.id, name: d.user.name }))} />
          </CardContent>
        </Card>
      )}

      {canManageWalkIns && calledWalkIns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("walkInsCalled")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {calledWalkIns.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge className="text-base">#{w.tokenNumber}</Badge>
                  <p className="font-medium">{w.name || t("anonymousWalkIn")}</p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/staff/queue/walk-ins/${w.id}`}>{t("startVisit")}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{canManageWalkIns ? t("waiting") : t("waitingToCheckIn")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {mergedWaiting.length === 0 && (
            <EmptyState
              icon={Clock}
              message={canManageWalkIns ? t("noOneWaiting") : t("noneWaiting")}
            />
          )}
          {mergedWaiting.map((row, index) =>
            row.kind === "appointment" ? (
              <div
                key={`appt-${row.appointment.id}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {canManageWalkIns && <Badge variant="outline">{t("booked")}</Badge>}
                  <div>
                    <Link
                      href={`/staff/patients/${row.appointment.patientId}`}
                      className="font-medium underline"
                    >
                      {row.appointment.patient.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {new Date(row.appointment.scheduledAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {showDoctorColumn && ` — ${row.appointment.doctor.user.name}`}
                    </p>
                  </div>
                </div>
                {session.user.role !== "DOCTOR" && (
                  <div className="flex gap-2">
                    <form action={checkInAppointment.bind(null, row.appointment.id)}>
                      <Button size="sm" type="submit">
                        {t("checkIn")}
                      </Button>
                    </form>
                    <form action={markNoShow.bind(null, row.appointment.id)}>
                      <Button size="sm" variant="outline" type="submit">
                        {t("noShow")}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div
                key={`walkin-${row.walkIn.id}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-base">
                    #{row.walkIn.tokenNumber}
                  </Badge>
                  <div>
                    <p className="font-medium">{row.walkIn.name || t("anonymousWalkIn")}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.walkIn.phone && `${row.walkIn.phone} — `}
                      {row.walkIn.reason || t("noReasonGiven")}
                      {row.walkIn.doctor && ` — ${row.walkIn.doctor.user.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("estimatedWait", { minutes: estimateWaitMinutes(index + 1) })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={callWalkIn.bind(null, row.walkIn.id)}>
                    <Button size="sm" type="submit">
                      {t("callToken")}
                    </Button>
                  </form>
                  <form action={cancelWalkIn.bind(null, row.walkIn.id)}>
                    <Button size="sm" variant="outline" type="submit">
                      {t("cancel")}
                    </Button>
                  </form>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("inQueue")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {inQueue.length === 0 && <EmptyState icon={ListOrdered} message={t("queueEmpty")} />}
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
