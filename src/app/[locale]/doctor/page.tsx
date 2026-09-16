import type { ReactNode } from "react";
import {
  CalendarDays,
  Clock,
  Activity,
  CheckCircle2,
  Siren,
  AlertTriangle,
} from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolidStatCard } from "@/components/solid-stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { getDisplayFirstName, initials, calculateAge, formatRelativeTime } from "@/lib/format";
import { todayRange } from "@/lib/queue";
import { clinicLocalMinutes, formatClinicDateTime } from "@/lib/clinic-hours";
import { getVitalsAlertMessage } from "@/lib/clinical-alerts";
import { AppointmentRow, AVATAR_COLORS, GENDER_LETTER } from "@/components/appointments/appointment-row";
import { isDoctorRangeBooking, formatAppointmentTime } from "@/lib/appointment-provider";

const LAB_RESULT_LABEL: Record<string, string> = {
  HIGH: "elevated",
  LOW: "low",
  BORDERLINE: "borderline",
};

function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}

export default async function DoctorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ schedule?: string }>;
}) {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  const { schedule: scheduleParam } = await searchParams;
  const scheduleTab: "today" | "upcoming" = scheduleParam === "upcoming" ? "upcoming" : "today";

  const { start: todayStart, end: todayEnd } = todayRange();
  const isRangeBooking = doctorId ? await isDoctorRangeBooking(doctorId) : false;

  const [todaysAppointmentsFull, recentAbnormalLabResults, upcomingAppointmentsFull] = doctorId
    ? await Promise.all([
        prisma.appointment.findMany({
          where: {
            doctorId,
            scheduledAt: { gte: todayStart, lt: todayEnd },
            status: { not: "CANCELLED" },
          },
          orderBy: { scheduledAt: "asc" },
          include: {
            patient: {
              include: {
                allergyRecords: { where: { severity: "SEVERE" }, take: 1 },
                diagnoses: { where: { severity: "SEVERE", status: "ACTIVE" }, take: 1 },
              },
            },
          },
        }),
        prisma.labOrderItem.findMany({
          where: {
            labOrder: { doctorId, status: "COMPLETED" },
            resultStatus: { in: ["HIGH", "LOW", "BORDERLINE"] },
          },
          include: { labTest: true, labOrder: { include: { patient: true } } },
          orderBy: { resultEnteredAt: "desc" },
          take: 3,
        }),
        // Same "upcoming" definition as /doctor/appointments's Upcoming tab —
        // future days beyond today, still REQUESTED/CONFIRMED (not yet
        // resolved either way).
        prisma.appointment.findMany({
          where: {
            doctorId,
            scheduledAt: { gte: todayEnd },
            status: { in: ["REQUESTED", "CONFIRMED"] },
          },
          orderBy: { scheduledAt: "asc" },
          take: 10,
          include: { patient: true },
        }),
      ])
    : [[], [], []];

  const checkedInToday = todaysAppointmentsFull
    .filter((appt) => appt.status === "CHECKED_IN")
    .sort((a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0));
  const inProgressAppt = checkedInToday[0] ?? null;
  const waitingAppts = checkedInToday.slice(1);
  const completedAppts = todaysAppointmentsFull.filter((appt) => appt.status === "COMPLETED");

  type RedAlert = {
    key: string;
    appointmentId: string;
    patientName: string;
    message: string;
    timeLabel: string;
  };
  const redAlerts: RedAlert[] = [];
  for (const appt of todaysAppointmentsFull) {
    if (appt.status === "CHECKED_IN") {
      const vitalsMessage = getVitalsAlertMessage(
        appt.spo2Percent,
        appt.heartRateBpm,
        appt.temperatureC ? Number(appt.temperatureC) : null
      );
      if (vitalsMessage) {
        redAlerts.push({
          key: `vitals-${appt.id}`,
          appointmentId: appt.id,
          patientName: appt.patient.name,
          message: vitalsMessage,
          timeLabel: "Now",
        });
      }
    }
    if (
      (appt.patient.allergyRecords.length > 0 || appt.patient.diagnoses.length > 0) &&
      appt.status !== "COMPLETED"
    ) {
      redAlerts.push({
        key: `severe-${appt.id}`,
        appointmentId: appt.id,
        patientName: appt.patient.name,
        message: "Severe allergy or diagnosis on file — review before consultation",
        timeLabel: "",
      });
    }
  }

  const amberAlerts = recentAbnormalLabResults
    .filter((item) => item.resultStatus)
    .map((item) => ({
      key: item.id,
      href: `/lab-report/${item.labOrderId}`,
      patientName: item.labOrder.patient.name,
      message: `Lab results returned: ${item.labTest.name} ${LAB_RESULT_LABEL[item.resultStatus as string]}${
        item.resultValue ? ` (${item.resultValue}${item.labTest.unit ?? ""})` : ""
      }. Review recommended.`,
      timeLabel: item.resultEnteredAt ? formatRelativeTime(item.resultEnteredAt) : "",
    }));

  const firstName = session.user.name ? getDisplayFirstName(session.user.name) : "";
  const now = new Date();
  const clinicHour = Math.floor(clinicLocalMinutes(now) / 60);
  const greeting = clinicHour < 12 ? "Good morning" : clinicHour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatClinicDateTime(now, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-2xl font-bold">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            You have <Num>{todaysAppointmentsFull.length}</Num> appointment
            {todaysAppointmentsFull.length === 1 ? "" : "s"} scheduled today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={inProgressAppt ? `/doctor/appointments/${inProgressAppt.id}` : "/doctor/consultations"}>
              <Activity className="size-4" />
              Start Consultation
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/doctor/schedule">
              <Clock className="size-4" />
              Schedule
            </Link>
          </Button>
        </div>
      </div>

      {(redAlerts.length > 0 || amberAlerts.length > 0) && (
        <div className="grid gap-3">
          {redAlerts.map((alert) => (
            <div
              key={alert.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30"
            >
              <div className="flex items-start gap-3">
                <Siren className="mt-0.5 size-5 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {alert.patientName} — {alert.message}
                  </p>
                  {alert.timeLabel && (
                    <p className="text-xs text-red-700/70 dark:text-red-300/70">{alert.timeLabel}</p>
                  )}
                </div>
              </div>
              <Button asChild size="sm" variant="destructive">
                <Link href={`/doctor/appointments/${alert.appointmentId}`}>View</Link>
              </Button>
            </div>
          ))}
          {amberAlerts.map((alert) => (
            <div
              key={alert.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {alert.patientName} — {alert.message}
                  </p>
                  {alert.timeLabel && (
                    <p className="text-xs text-amber-700/70 dark:text-amber-300/70">{alert.timeLabel}</p>
                  )}
                </div>
              </div>
              <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
                <Link href={alert.href}>View</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SolidStatCard
          icon={CalendarDays}
          label="Today's Total"
          value={todaysAppointmentsFull.length}
          sublabel="appointments"
          className="bg-blue-600"
        />
        <SolidStatCard
          icon={Clock}
          label="Waiting"
          value={waitingAppts.length}
          sublabel="patients in queue"
          className="bg-amber-600"
        />
        <SolidStatCard
          icon={Activity}
          label="In Progress"
          value={inProgressAppt ? 1 : 0}
          sublabel="active consultation"
          className="bg-sky-600"
        />
        <SolidStatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedAppts.length}
          sublabel="consultations today"
          className="bg-indigo-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{scheduleTab === "today" ? "Today's Schedule" : "Upcoming Schedule"}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
                <Link
                  href="/doctor?schedule=today"
                  className={
                    scheduleTab === "today"
                      ? "rounded-md bg-card px-3 py-1 text-sm font-medium text-primary shadow-sm"
                      : "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  Today
                </Link>
                <Link
                  href="/doctor?schedule=upcoming"
                  className={
                    scheduleTab === "upcoming"
                      ? "rounded-md bg-card px-3 py-1 text-sm font-medium text-primary shadow-sm"
                      : "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  Upcoming
                </Link>
              </div>
              <Link href="/doctor/appointments" className="text-sm underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {scheduleTab === "today" ? (
              todaysAppointmentsFull.length === 0 ? (
                <EmptyState icon={CalendarDays} message="No appointments scheduled today." />
              ) : (
                todaysAppointmentsFull.map((appt, index) => {
                  const isInProgress = inProgressAppt?.id === appt.id;
                  const isWaiting = waitingAppts.some((a) => a.id === appt.id);
                  const isUrgent = redAlerts.some((a) => a.appointmentId === appt.id);
                  const age = calculateAge(appt.patient.dob);
                  const genderLetter = appt.patient.gender ? GENDER_LETTER[appt.patient.gender] : null;
                  const statusLabel =
                    appt.status === "COMPLETED"
                      ? "Completed"
                      : isInProgress
                        ? "In Progress"
                        : isWaiting
                          ? "Waiting"
                          : appt.status === "NO_SHOW"
                            ? "No-show"
                            : "Scheduled";
                  const statusClass =
                    appt.status === "COMPLETED"
                      ? "bg-indigo-100 text-indigo-700"
                      : isInProgress
                        ? "bg-blue-100 text-blue-700"
                        : isWaiting
                          ? "bg-amber-100 text-amber-700"
                          : appt.status === "NO_SHOW"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-700";
                  return (
                    <AppointmentRow
                      key={appt.id}
                      href={`/doctor/appointments/${appt.id}`}
                      time={formatAppointmentTime(appt, isRangeBooking, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      avatarIndex={index}
                      patientName={appt.patient.name}
                      age={age}
                      genderLetter={genderLetter}
                      reason={appt.reason ?? ""}
                      isUrgent={isUrgent}
                      statusLabel={statusLabel}
                      statusClassName={statusClass}
                    />
                  );
                })
              )
            ) : upcomingAppointmentsFull.length === 0 ? (
              <EmptyState icon={CalendarDays} message="No upcoming appointments." />
            ) : (
              upcomingAppointmentsFull.map((appt, index) => {
                const age = calculateAge(appt.patient.dob);
                const genderLetter = appt.patient.gender ? GENDER_LETTER[appt.patient.gender] : null;
                return (
                  <AppointmentRow
                    key={appt.id}
                    href={`/doctor/appointments/${appt.id}`}
                    time={formatAppointmentTime(appt, isRangeBooking, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    dateLabel={appt.scheduledAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    avatarIndex={index}
                    patientName={appt.patient.name}
                    age={age}
                    genderLetter={genderLetter}
                    reason={appt.reason ?? ""}
                    isUrgent={false}
                    statusLabel={appt.status === "CONFIRMED" ? "Confirmed" : "Requested"}
                    statusClassName={
                      appt.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Waiting Room</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {checkedInToday.length === 0 ? (
                <EmptyState icon={Clock} message="No one waiting right now." />
              ) : (
                checkedInToday.map((appt, index) => {
                  const isInProgress = inProgressAppt?.id === appt.id;
                  const isUrgent = redAlerts.some((a) => a.appointmentId === appt.id);
                  return (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className={AVATAR_COLORS[index % AVATAR_COLORS.length]}>
                            {initials(appt.patient.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{appt.patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {appt.reason || "No reason given"}
                          </p>
                        </div>
                      </div>
                      <Button asChild size="sm" variant={isUrgent ? "destructive" : "default"}>
                        <Link href={`/doctor/appointments/${appt.id}`}>
                          {isInProgress ? "Resume" : "Start"}
                        </Link>
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
