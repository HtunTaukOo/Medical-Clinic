import { CalendarDays, Pill } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clinicDateKey, clinicDateParts, formatClinicDateTime } from "@/lib/clinic-hours";
import { leaveWaitlist } from "@/actions/waitlist";
import { getMonthGrid, addMonths, MONTH_NAMES } from "@/lib/calendar";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PatientAppointmentCard } from "@/components/appointments/patient-appointment-card";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const APPOINTMENT_TABS = ["upcoming", "completed", "cancelled"] as const;
type AppointmentTab = (typeof APPOINTMENT_TABS)[number];

const TAB_META: Record<AppointmentTab, { label: string; badgeClass: string }> = {
  upcoming: { label: "Upcoming", badgeClass: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", badgeClass: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", badgeClass: "bg-rose-100 text-rose-700" },
};

export default async function PortalAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string; tab?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("appointments");
  const patientId = session?.user.patientId;

  const {
    view: viewParam,
    year: yearParam,
    month: monthParam,
    tab: tabParam,
  } = await searchParams;
  const view = viewParam === "calendar" ? "calendar" : "list";
  const tab: AppointmentTab = APPOINTMENT_TABS.includes(tabParam as AppointmentTab)
    ? (tabParam as AppointmentTab)
    : "upcoming";

  const now = new Date();
  const clinicToday = clinicDateParts(now);
  const year = yearParam ? Number(yearParam) : clinicToday.year;
  const month = monthParam ? Number(monthParam) : clinicToday.month;

  const appointments = patientId
    ? await prisma.appointment.findMany({
        where: { patientId },
        orderBy: { scheduledAt: "desc" },
        include: { doctor: { include: { user: true } } },
      })
    : [];

  const appointmentsByTab: Record<AppointmentTab, typeof appointments> = {
    upcoming: appointments.filter(
      (appt) =>
        appt.status === "REQUESTED" || appt.status === "CONFIRMED" || appt.status === "CHECKED_IN"
    ),
    completed: appointments.filter((appt) => appt.status === "COMPLETED"),
    cancelled: appointments.filter(
      (appt) => appt.status === "CANCELLED" || appt.status === "NO_SHOW"
    ),
  };
  const visibleAppointments = view === "list" ? appointmentsByTab[tab] : appointments;

  const waitlistEntries = patientId
    ? await prisma.waitlist.findMany({
        where: { patientId, status: { in: ["WAITING", "NOTIFIED"] } },
        orderBy: { requestedAt: "asc" },
        include: { doctor: { include: { user: true } } },
      })
    : [];

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

  const gridStart = weeks[0][0];
  const gridEnd = new Date(weeks[weeks.length - 1][6]);
  gridEnd.setDate(gridEnd.getDate() + 1);

  const pillReminders = patientId
    ? await prisma.pillReminder.findMany({
        where: { patientId, scheduledFor: { gte: gridStart, lt: gridEnd } },
        include: { prescriptionItem: { include: { medicine: true } } },
        orderBy: { scheduledFor: "asc" },
      })
    : [];

  const remindersByDay = new Map<string, typeof pillReminders>();
  for (const reminder of pillReminders) {
    const key = clinicDateKey(reminder.scheduledFor);
    const list = remindersByDay.get(key) ?? [];
    list.push(reminder);
    remindersByDay.set(key, list);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/portal/book">{t("requestNew")}</Link>
        </Button>
      </div>

      {waitlistEntries.length > 0 && (
        <Card>
          <CardContent className="grid gap-2">
            <p className="text-sm font-medium">Waitlist</p>
            {waitlistEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{entry.doctor.user.name}</p>
                  <p className="text-muted-foreground">
                    Requested around {formatClinicDateTime(entry.requestedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.status === "NOTIFIED" ? "success" : "outline"}>
                    {entry.status === "NOTIFIED" ? "Opening available!" : "Waiting"}
                  </Badge>
                  <form action={leaveWaitlist.bind(null, entry.id)}>
                    <Button size="sm" variant="outline" type="submit">
                      Leave waitlist
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button asChild variant={view === "list" ? "default" : "outline"} size="sm">
          <Link href="/portal/appointments?view=list">List</Link>
        </Button>
        <Button asChild variant={view === "calendar" ? "default" : "outline"} size="sm">
          <Link href="/portal/appointments?view=calendar">Calendar</Link>
        </Button>
      </div>

      {view === "list" && (
        <div className="flex flex-wrap items-center gap-2">
          {APPOINTMENT_TABS.map((value) => {
            const active = tab === value;
            return (
              <Link
                key={value}
                href={`/portal/appointments?view=list&tab=${value}`}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border bg-white text-foreground hover:bg-muted/50"
                )}
              >
                {TAB_META[value].label}
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    active ? "bg-white/25" : "bg-muted text-muted-foreground"
                  )}
                >
                  {appointmentsByTab[value].length}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {view === "list" ? (
        visibleAppointments.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t("noResults")} />
        ) : (
          <div className="grid gap-3">
            {visibleAppointments.map((appt, index) => (
              <PatientAppointmentCard
                key={appt.id}
                href={`/portal/appointments/${appt.id}`}
                avatarIndex={index}
                doctorName={appt.doctor.user.name}
                specialty={appt.doctor.specialty ?? "General Medicine"}
                reason={appt.reason}
                dateLabel={formatClinicDateTime(appt.scheduledAt, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                timeLabel={formatClinicDateTime(appt.scheduledAt, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                statusLabel={TAB_META[tab].label}
                statusClassName={TAB_META[tab].badgeClass}
              />
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
                <Link href={`/portal/appointments?view=calendar&year=${prev.year}&month=${prev.month}`}>
                  ← Prev
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/portal/appointments?view=calendar&year=${clinicToday.year}&month=${clinicToday.month}`}
                >
                  Today
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/portal/appointments?view=calendar&year=${next.year}&month=${next.month}`}>
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
                const dayReminders = remindersByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={`min-h-28 bg-background p-1.5 align-top ${
                      inMonth ? "" : "text-muted-foreground/50"
                    } ${key === todayKey ? "ring-2 ring-inset ring-primary" : ""}`}
                  >
                    <p className="mb-1 text-xs font-medium">{day.getDate()}</p>
                    <div className="grid gap-1">
                      {dayAppointments.slice(0, 3).map((appt) => (
                        <Link
                          key={appt.id}
                          href={`/portal/appointments/${appt.id}`}
                          className={`truncate rounded px-1 py-0.5 text-xs ${STATUS_STYLES[appt.status]}`}
                          title={`${appt.doctor.user.name} — ${appt.status}`}
                        >
                          {new Date(appt.scheduledAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {appt.doctor.user.name}
                        </Link>
                      ))}
                      {dayAppointments.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{dayAppointments.length - 3} more
                        </span>
                      )}
                      {dayReminders.slice(0, 2).map((reminder) => (
                        <div
                          key={reminder.id}
                          className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs ${
                            reminder.sent
                              ? "bg-muted text-muted-foreground"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                          title={`${reminder.prescriptionItem.medicine.name} — ${
                            reminder.sent ? "reminder sent" : "reminder pending"
                          }`}
                        >
                          <Pill className="size-3 shrink-0" />
                          <span className="truncate">
                            {new Date(reminder.scheduledFor).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            {reminder.prescriptionItem.medicine.name}
                          </span>
                        </div>
                      ))}
                      {dayReminders.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{dayReminders.length - 2} more reminder
                          {dayReminders.length - 2 === 1 ? "" : "s"}
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
