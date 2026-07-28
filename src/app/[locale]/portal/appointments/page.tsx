import { CalendarDays, Stethoscope, Pill } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getQueuePosition, isWithinSelfCheckInWindow } from "@/lib/queue";
import { checkInAppointment, cancelAppointment } from "@/actions/appointments";
import { getMonthGrid, dateKey, addMonths, MONTH_NAMES } from "@/lib/calendar";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function PortalAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("appointments");
  const patientId = session?.user.patientId;

  const { view: viewParam, year: yearParam, month: monthParam } = await searchParams;
  const view = viewParam === "calendar" ? "calendar" : "list";

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;

  const appointments = patientId
    ? await prisma.appointment.findMany({
        where: { patientId },
        orderBy: { scheduledAt: "desc" },
        include: { doctor: { include: { user: true } } },
      })
    : [];

  const queuePositions = new Map<string, number>();
  for (const appt of appointments) {
    if (appt.status === "CHECKED_IN" && appt.checkedInAt) {
      queuePositions.set(
        appt.id,
        await getQueuePosition(appt.doctorId, appt.checkedInAt)
      );
    }
  }

  const weeks = getMonthGrid(year, month);
  const byDay = new Map<string, typeof appointments>();
  for (const appt of appointments) {
    const key = dateKey(new Date(appt.scheduledAt));
    const list = byDay.get(key) ?? [];
    list.push(appt);
    byDay.set(key, list);
  }
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const todayKey = dateKey(now);

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
    const key = dateKey(new Date(reminder.scheduledFor));
    const list = remindersByDay.get(key) ?? [];
    list.push(reminder);
    remindersByDay.set(key, list);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/portal/appointments/new">{t("requestNew")}</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant={view === "list" ? "default" : "outline"} size="sm">
          <Link href="/portal/appointments?view=list">List</Link>
        </Button>
        <Button asChild variant={view === "calendar" ? "default" : "outline"} size="sm">
          <Link href="/portal/appointments?view=calendar">Calendar</Link>
        </Button>
      </div>

      {view === "list" ? (
        appointments.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t("noResults")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appt) => {
              const position = queuePositions.get(appt.id);
              const canSelfCheckIn =
                appt.status === "CONFIRMED" && isWithinSelfCheckInWindow(appt.scheduledAt);
              const canCancel =
                appt.status === "REQUESTED" || appt.status === "CONFIRMED";
              return (
                <Card key={appt.id}>
                  <CardContent className="grid gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Stethoscope className="size-4" />
                        {appt.doctor.user.name}
                      </div>
                      <Badge variant="outline">{appt.status}</Badge>
                    </div>
                    <Link
                      href={`/portal/appointments/${appt.id}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:underline"
                    >
                      <CalendarDays className="size-4" />
                      {new Date(appt.scheduledAt).toLocaleString()}
                    </Link>
                    {position !== undefined && (
                      <p className="text-sm font-medium text-primary">
                        {t("queuePosition", { position, doctor: appt.doctor.user.name })}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {canSelfCheckIn && (
                        <form action={checkInAppointment.bind(null, appt.id)}>
                          <Button size="sm" type="submit" className="w-fit">
                            {t("checkIn")}
                          </Button>
                        </form>
                      )}
                      {canCancel && (
                        <form action={cancelAppointment.bind(null, appt.id)}>
                          <Button size="sm" variant="destructive" type="submit" className="w-fit">
                            {t("cancel")}
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                  href={`/portal/appointments?view=calendar&year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
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
                const key = dateKey(day);
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
