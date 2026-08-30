import { CalendarDays, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { getMonthGrid, addMonths, MONTH_NAMES } from "@/lib/calendar";
import { todayRange } from "@/lib/queue";
import { clinicDateKey, clinicDateParts, formatClinicDateTime } from "@/lib/clinic-hours";
import { initials, calculateAge } from "@/lib/format";
import { isAppointmentUrgent } from "@/lib/clinical-alerts";
import {
  confirmAppointment,
  checkInAppointment,
  cancelAppointment,
  completeAppointment,
  markNoShow,
} from "@/actions/appointments";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { AppointmentRow, GENDER_LETTER } from "@/components/appointments/appointment-row";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOCTOR_TABS = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;
type DoctorTab = (typeof DOCTOR_TABS)[number]["value"];

function getRowDisplay(
  status: string,
  { isInProgress, isWaiting }: { isInProgress: boolean; isWaiting: boolean }
) {
  if (status === "COMPLETED") return { label: "Completed", className: "bg-indigo-100 text-indigo-700" };
  if (status === "CANCELLED") return { label: "Cancelled", className: "bg-rose-100 text-rose-700" };
  if (status === "NO_SHOW") return { label: "No-show", className: "bg-rose-100 text-rose-700" };
  if (isInProgress) return { label: "In Progress", className: "bg-blue-100 text-blue-700" };
  if (isWaiting) return { label: "Waiting", className: "bg-amber-100 text-amber-700" };
  return { label: "Scheduled", className: "bg-slate-100 text-slate-700" };
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string; tab?: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("appointments");
  const isDoctor = session.user.role === "DOCTOR";

  const { view: viewParam, year: yearParam, month: monthParam, tab: tabParam } =
    await searchParams;
  const view = isDoctor ? "list" : viewParam === "calendar" ? "calendar" : "list";
  const tab: DoctorTab = DOCTOR_TABS.some(({ value }) => value === tabParam)
    ? (tabParam as DoctorTab)
    : "today";

  const now = new Date();
  const clinicToday = clinicDateParts(now);
  const year = yearParam ? Number(yearParam) : clinicToday.year;
  const month = monthParam ? Number(monthParam) : clinicToday.month;

  const appointments = await prisma.appointment.findMany({
    where: isDoctor ? { doctorId: session.user.doctorId } : undefined,
    orderBy: { scheduledAt: "desc" },
    include: {
      patient: {
        include: {
          allergyRecords: { where: { severity: "SEVERE" }, take: 1 },
          diagnoses: { where: { severity: "SEVERE", status: "ACTIVE" }, take: 1 },
        },
      },
      doctor: { include: { user: true } },
    },
  });

  const { start: todayStart, end: todayEnd } = todayRange();

  function matchesTab(appt: (typeof appointments)[number], value: DoctorTab) {
    if (value === "today") {
      return (
        appt.scheduledAt >= todayStart &&
        appt.scheduledAt < todayEnd &&
        appt.status !== "CANCELLED"
      );
    }
    if (value === "upcoming") {
      return (
        appt.scheduledAt >= todayEnd &&
        (appt.status === "REQUESTED" || appt.status === "CONFIRMED")
      );
    }
    if (value === "completed") return appt.status === "COMPLETED";
    return appt.status === "CANCELLED" || appt.status === "NO_SHOW";
  }

  const tabCounts: Record<DoctorTab, number> = {
    today: appointments.filter((a) => matchesTab(a, "today")).length,
    upcoming: appointments.filter((a) => matchesTab(a, "upcoming")).length,
    completed: appointments.filter((a) => matchesTab(a, "completed")).length,
    cancelled: appointments.filter((a) => matchesTab(a, "cancelled")).length,
  };

  const checkedInToday = appointments
    .filter((a) => matchesTab(a, "today") && a.status === "CHECKED_IN")
    .sort((a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0));
  const inProgressApptId = checkedInToday[0]?.id ?? null;
  const waitingApptIds = new Set(checkedInToday.slice(1).map((a) => a.id));

  const doctorVisibleAppointments = appointments
    .filter((a) => matchesTab(a, tab))
    .sort((a, b) =>
      tab === "completed" || tab === "cancelled"
        ? b.scheduledAt.getTime() - a.scheduledAt.getTime()
        : a.scheduledAt.getTime() - b.scheduledAt.getTime()
    );

  const weeks = getMonthGrid(year, month);
  const byDay = new Map<string, typeof appointments>();
  for (const appt of appointments) {
    const key = clinicDateKey(appt.scheduledAt);
    const list = byDay.get(key) ?? [];
    list.push(appt);
    byDay.set(key, list);
  }
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const todayKey = clinicDateKey(now);

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          {session.user.role !== "DOCTOR" && (
            <Button asChild>
              <Link href="/staff/appointments/new">{t("new")}</Link>
            </Button>
          )}
        </div>
        {isDoctor && (
          <p className="text-sm text-muted-foreground">
            Manage your patient appointments and consultations.
          </p>
        )}
      </div>

      {!isDoctor && (
        <div className="flex items-center gap-2">
          <Button asChild variant={view === "list" ? "default" : "outline"} size="sm">
            <Link href="/staff/appointments?view=list">List</Link>
          </Button>
          <Button asChild variant={view === "calendar" ? "default" : "outline"} size="sm">
            <Link href="/staff/appointments?view=calendar">Calendar</Link>
          </Button>
        </div>
      )}

      {isDoctor && (
        <div className="flex flex-wrap items-center gap-2">
          {DOCTOR_TABS.map(({ value, label }) => (
            <Button key={value} asChild variant={tab === value ? "default" : "outline"} className="gap-2">
              <Link href={`/staff/appointments?tab=${value}`}>
                {label}
                <Badge
                  variant="secondary"
                  className={tab === value ? "bg-white/20 text-white" : undefined}
                >
                  {tabCounts[value]}
                </Badge>
              </Link>
            </Button>
          ))}
        </div>
      )}

      {isDoctor ? (
        <div className="grid gap-2">
          {doctorVisibleAppointments.length === 0 ? (
            <EmptyState icon={CalendarDays} message={t("noResults")} />
          ) : (
            doctorVisibleAppointments.map((appt, index) => {
              const isInProgress = tab === "today" && appt.id === inProgressApptId;
              const isWaiting = tab === "today" && waitingApptIds.has(appt.id);
              const { label, className } = getRowDisplay(appt.status, { isInProgress, isWaiting });
              const isUrgent = tab === "today" && isAppointmentUrgent(appt);
              const age = calculateAge(appt.patient.dob);
              const genderLetter = appt.patient.gender ? GENDER_LETTER[appt.patient.gender] : null;
              return (
                <AppointmentRow
                  key={appt.id}
                  href={`/staff/appointments/${appt.id}`}
                  time={appt.scheduledAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  dateLabel={
                    tab === "today"
                      ? undefined
                      : appt.scheduledAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                  }
                  avatarIndex={index}
                  patientName={appt.patient.name}
                  age={age}
                  genderLetter={genderLetter}
                  reason={appt.reason ?? ""}
                  isUrgent={isUrgent}
                  statusLabel={label}
                  statusClassName={className}
                />
              );
            })
          )}
        </div>
      ) : view === "list" ? (
        appointments.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t("noResults")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appt) => (
              <Card key={appt.id}>
                <CardContent className="grid gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/staff/patients/${appt.patientId}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="size-12">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {initials(appt.patient.name)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{appt.patient.name}</p>
                    </Link>
                    <Badge variant="outline">{appt.status}</Badge>
                  </div>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="size-4" />
                      {appt.doctor.user.name}
                    </div>
                    <Link
                      href={`/staff/appointments/${appt.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <CalendarDays className="size-4" />
                      {formatClinicDateTime(appt.scheduledAt)}
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {appt.status === "REQUESTED" && (
                      <form action={confirmAppointment.bind(null, appt.id)}>
                        <Button size="sm" variant="secondary" type="submit">
                          {t("confirm")}
                        </Button>
                      </form>
                    )}
                    {appt.status === "CONFIRMED" && session.user.role !== "DOCTOR" && (
                      <form action={checkInAppointment.bind(null, appt.id)}>
                        <Button size="sm" variant="secondary" type="submit">
                          {t("checkIn")}
                        </Button>
                      </form>
                    )}
                    {appt.status === "CONFIRMED" && (
                      <form action={markNoShow.bind(null, appt.id)}>
                        <Button size="sm" variant="outline" type="submit">
                          {t("noShow")}
                        </Button>
                      </form>
                    )}
                    {(appt.status === "REQUESTED" ||
                      appt.status === "CONFIRMED" ||
                      appt.status === "CHECKED_IN") && (
                      <>
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
                      </>
                    )}
                    {session.user.role === "DOCTOR" &&
                      (appt.status === "CHECKED_IN" || appt.status === "COMPLETED") && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/staff/appointments/${appt.id}`}>
                          {t("writePrescription")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/staff/appointments?view=calendar&year=${prev.year}&month=${prev.month}`}>
                  ← Prev
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/staff/appointments?view=calendar&year=${clinicToday.year}&month=${clinicToday.month}`}
                >
                  Today
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/staff/appointments?view=calendar&year=${next.year}&month=${next.month}`}>
                  Next →
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[840px] grid-cols-7 gap-px rounded-lg border bg-border text-sm">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="bg-muted p-2 text-center font-medium">
                  {label}
                </div>
              ))}
              {weeks.flat().map((day) => {
                const key = clinicDateKey(day);
                const inMonth = day.getMonth() === month - 1;
                const dayAppointments = byDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={`min-h-28 bg-background p-1.5 align-top ${
                      inMonth ? "" : "text-muted-foreground/50"
                    } ${key === todayKey ? "ring-2 ring-inset ring-primary" : ""}`}
                  >
                    <p className="mb-1 text-xs font-medium">{day.getDate()}</p>
                    <div className="grid gap-1">
                      {dayAppointments.slice(0, 4).map((appt) => (
                        <Link
                          key={appt.id}
                          href={`/staff/appointments/${appt.id}`}
                          className={`truncate rounded px-1 py-0.5 text-xs ${STATUS_STYLES[appt.status]}`}
                          title={`${appt.patient.name} — ${appt.doctor.user.name}`}
                        >
                          {new Date(appt.scheduledAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {appt.patient.name}
                        </Link>
                      ))}
                      {dayAppointments.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{dayAppointments.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
