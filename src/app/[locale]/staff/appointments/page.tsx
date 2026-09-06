import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { getMonthGrid, addMonths, MONTH_NAMES } from "@/lib/calendar";
import { todayRange } from "@/lib/queue";
import { clinicDateKey, clinicDateParts } from "@/lib/clinic-hours";
import {
  confirmAppointment,
  checkInAppointment,
  cancelAppointment,
  completeAppointment,
} from "@/actions/appointments";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { RescheduleDialog } from "@/components/appointments/reschedule-dialog";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TABS = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function getRowDisplay(
  status: string,
  { isInProgress, isWaiting }: { isInProgress: boolean; isWaiting: boolean }
) {
  if (status === "COMPLETED") return { label: "Completed", className: "bg-emerald-100 text-emerald-700" };
  if (status === "CANCELLED") return { label: "Cancelled", className: "bg-rose-100 text-rose-700" };
  if (status === "NO_SHOW") return { label: "No-show", className: "bg-rose-100 text-rose-700" };
  if (isInProgress) return { label: "In Progress", className: "bg-purple-100 text-purple-700" };
  if (isWaiting || status === "CONFIRMED") {
    return { label: "Waiting", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Scheduled", className: "bg-blue-100 text-blue-700" };
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string; tab?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("appointments");

  const { view: viewParam, year: yearParam, month: monthParam, tab: tabParam } =
    await searchParams;
  const view = viewParam === "calendar" ? "calendar" : "list";
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "today";

  const now = new Date();
  const clinicToday = clinicDateParts(now);
  const year = yearParam ? Number(yearParam) : clinicToday.year;
  const month = monthParam ? Number(monthParam) : clinicToday.month;

  const appointments = await prisma.appointment.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      patient: true,
      doctor: { include: { user: true } },
    },
  });

  const { start: todayStart, end: todayEnd } = todayRange();

  function matchesTab(appt: (typeof appointments)[number], value: Tab) {
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

  const tabCounts: Record<Tab, number> = {
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

  const visibleAppointments = appointments
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            Manage patient appointments, confirmations, and check-ins.
          </p>
        </div>
        <Button asChild>
          <Link href="/staff/appointments/new">{t("new")}</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant={view === "list" ? "default" : "outline"} size="sm">
          <Link href={`/staff/appointments?view=list&tab=${tab}`}>List</Link>
        </Button>
        <Button asChild variant={view === "calendar" ? "default" : "outline"} size="sm">
          <Link href="/staff/appointments?view=calendar">Calendar</Link>
        </Button>
      </div>

      {view === "list" && (
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map(({ value, label }) => (
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

      {view === "calendar" ? (
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
      ) : visibleAppointments.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t("noResults")} />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAppointments.map((appt, index) => {
                  const isInProgress = tab === "today" && appt.id === inProgressApptId;
                  const isWaiting = tab === "today" && waitingApptIds.has(appt.id);
                  const { label, className } = getRowDisplay(appt.status, { isInProgress, isWaiting });
                  return (
                    <TableRow key={appt.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/staff/patients/${appt.patientId}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {appt.patient.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{appt.doctor.user.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {appt.doctor.specialty ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tab === "today"
                          ? appt.scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : appt.scheduledAt.toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {appt.reason || "Consultation"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={className}>
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-3">
                          {appt.status === "REQUESTED" && (
                            <>
                              <form action={confirmAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-primary underline underline-offset-2"
                                >
                                  Confirm
                                </button>
                              </form>
                              <RescheduleDialog
                                appointmentId={appt.id}
                                patientName={appt.patient.name}
                                trigger={
                                  <button
                                    type="button"
                                    className="font-medium text-primary underline underline-offset-2"
                                  >
                                    Reschedule
                                  </button>
                                }
                              />
                              <form action={cancelAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-destructive underline underline-offset-2"
                                >
                                  Cancel
                                </button>
                              </form>
                            </>
                          )}
                          {appt.status === "CONFIRMED" && (
                            <>
                              <form action={checkInAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-primary underline underline-offset-2"
                                >
                                  {t("checkIn")}
                                </button>
                              </form>
                              <RescheduleDialog
                                appointmentId={appt.id}
                                patientName={appt.patient.name}
                                trigger={
                                  <button
                                    type="button"
                                    className="font-medium text-primary underline underline-offset-2"
                                  >
                                    Reschedule
                                  </button>
                                }
                              />
                              <form action={cancelAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-destructive underline underline-offset-2"
                                >
                                  Cancel
                                </button>
                              </form>
                            </>
                          )}
                          {appt.status === "CHECKED_IN" && (
                            <>
                              <form action={completeAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-primary underline underline-offset-2"
                                >
                                  {t("complete")}
                                </button>
                              </form>
                              <form action={cancelAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-destructive underline underline-offset-2"
                                >
                                  Cancel
                                </button>
                              </form>
                            </>
                          )}
                          {(appt.status === "COMPLETED" ||
                            appt.status === "CANCELLED" ||
                            appt.status === "NO_SHOW") && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
