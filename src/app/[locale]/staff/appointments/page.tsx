import { CalendarDays, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { getMonthGrid, dateKey, addMonths, MONTH_NAMES } from "@/lib/calendar";
import { initials } from "@/lib/format";
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

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("appointments");

  const { view: viewParam, year: yearParam, month: monthParam } = await searchParams;
  const view = viewParam === "calendar" ? "calendar" : "list";

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;

  const appointments = await prisma.appointment.findMany({
    where:
      session.user.role === "DOCTOR"
        ? { doctorId: session.user.doctorId }
        : undefined,
    orderBy: { scheduledAt: "desc" },
    include: { patient: true, doctor: { include: { user: true } } },
  });

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

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {session.user.role !== "DOCTOR" && (
          <Button asChild>
            <Link href="/staff/appointments/new">{t("new")}</Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant={view === "list" ? "default" : "outline"} size="sm">
          <Link href="/staff/appointments?view=list">List</Link>
        </Button>
        <Button asChild variant={view === "calendar" ? "default" : "outline"} size="sm">
          <Link href="/staff/appointments?view=calendar">Calendar</Link>
        </Button>
      </div>

      {view === "list" ? (
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
                      {new Date(appt.scheduledAt).toLocaleString()}
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
                  href={`/staff/appointments?view=calendar&year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
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
                const key = dateKey(day);
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
