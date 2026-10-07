import { CalendarDays, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermissionPage } from "@/lib/authz";
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
import { SearchInput } from "@/components/search-input";
import { InventoryFilterSelect } from "@/components/inventory/inventory-filter-select";
import { DateFilterInput } from "@/components/appointments/date-filter-input";
import { BackLink } from "@/components/back-link";
import { RescheduleDialog } from "@/components/appointments/reschedule-dialog";
import { CompleteCheckoutButton } from "@/components/appointments/complete-checkout-button";
import { TabTransitionScope, TabButton, TabTransitionContent } from "@/components/tab-transition";
import {
  getRangeBookingSpecialtyNames,
  isRangeBookingAppointment,
  formatAppointmentTime,
} from "@/lib/appointment-provider";

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800 line-through",
  NO_SHOW: "bg-amber-100 text-amber-800",
};

const WEEKDAY_KEYS = [
  "sundayShort",
  "mondayShort",
  "tuesdayShort",
  "wednesdayShort",
  "thursdayShort",
  "fridayShort",
  "saturdayShort",
] as const;

const TABS = [
  { value: "all", labelKey: "all" },
  { value: "today", labelKey: "today" },
  { value: "upcoming", labelKey: "upcoming" },
  { value: "completed", labelKey: "completed" },
  { value: "cancelled", labelKey: "cancelled" },
] as const;
type Tab = (typeof TABS)[number]["value"];

// Maps the row's real status (plus consultationStartedAt) straight to a
// label — not a proxy like "first checked-in today" — so every row reads
// correctly on every tab, not just "Today". CONFIRMED means the slot is on
// the calendar but the patient hasn't arrived, so it reads "Confirmed", not
// "Waiting" (that's reserved for someone actually checked in and not yet
// with the doctor).
function getRowDisplay(status: string, consultationStartedAt: Date | null) {
  if (status === "COMPLETED") return { labelKey: "completed", className: "bg-emerald-100 text-emerald-700" };
  if (status === "CANCELLED") return { labelKey: "cancelled", className: "bg-rose-100 text-rose-700" };
  if (status === "NO_SHOW") return { labelKey: "noShow", className: "bg-rose-100 text-rose-700" };
  if (status === "CHECKED_IN") {
    return consultationStartedAt
      ? { labelKey: "inProgress", className: "bg-purple-100 text-purple-700" }
      : { labelKey: "waiting", className: "bg-amber-100 text-amber-700" };
  }
  if (status === "CONFIRMED") return { labelKey: "confirmed", className: "bg-blue-100 text-blue-700" };
  if (status === "REQUESTED") return { labelKey: "requested", className: "bg-amber-100 text-amber-700" };
  return { labelKey: "scheduled", className: "bg-blue-100 text-blue-700" };
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    year?: string;
    month?: string;
    tab?: string;
    q?: string;
    specialty?: string;
    date?: string;
    from?: string;
  }>;
}) {
  await requireStaffPermissionPage("VIEW_APPOINTMENTS");
  const t = await getTranslations("appointments");

  const {
    view: viewParam,
    year: yearParam,
    month: monthParam,
    tab: tabParam,
    q,
    specialty,
    date,
    from,
  } = await searchParams;
  const view = viewParam === "calendar" ? "calendar" : "list";
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "all";

  const now = new Date();
  const clinicToday = clinicDateParts(now);
  const year = yearParam ? Number(yearParam) : clinicToday.year;
  const month = monthParam ? Number(monthParam) : clinicToday.month;

  const [appointments, rangeBookingNames] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { scheduledAt: "desc" },
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    }),
    getRangeBookingSpecialtyNames(),
  ]);

  const specialties = [...new Set(appointments.map((a) => a.doctor.specialty).filter(Boolean))] as string[];

  const { start: todayStart, end: todayEnd } = todayRange();

  function matchesTab(appt: (typeof appointments)[number], value: Tab) {
    if (value === "all") return true;
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

  function matchesFilters(appt: (typeof appointments)[number]) {
    if (q) {
      const query = q.toLowerCase();
      const matchesQuery =
        appt.patient.name.toLowerCase().includes(query) ||
        appt.doctor.user.name.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }
    if (specialty && appt.doctor.specialty !== specialty) return false;
    if (date && clinicDateKey(appt.scheduledAt) !== date) return false;
    return true;
  }

  const filteredAppointments = appointments.filter(matchesFilters);

  const visibleAppointments = filteredAppointments
    .filter((a) => matchesTab(a, tab))
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

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

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (specialty) filterParams.set("specialty", specialty);
  if (date) filterParams.set("date", date);
  const filterQuery = filterParams.toString();

  return (
    <TabTransitionScope>
    <div className="grid gap-4">
      {from === "dashboard" && <BackLink href="/staff" />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("manageAppointments")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/staff/appointments/schedule">
              <CalendarDays className="size-4" />
              {t("schedule")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/staff/appointments/new">
              <Plus className="size-4" />
              {t("new")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TabButton
          href={`/staff/appointments?view=list&tab=${tab}${filterQuery ? `&${filterQuery}` : ""}`}
          active={view === "list"}
          size="sm"
        >
          {t("list")}
        </TabButton>
        <TabButton href="/staff/appointments?view=calendar" active={view === "calendar"} size="sm">
          {t("calendar")}
        </TabButton>
      </div>

      {view === "list" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map(({ value, labelKey }) => (
              <TabButton
                key={value}
                href={`/staff/appointments?tab=${value}${filterQuery ? `&${filterQuery}` : ""}`}
                active={tab === value}
              >
                {t(labelKey)}
              </TabButton>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder={t("searchPatientDoctor")} />
            <InventoryFilterSelect
              paramName="specialty"
              placeholder={t("allSpecialties")}
              options={specialties.map((s) => ({ value: s, label: s }))}
            />
            <DateFilterInput />
          </div>
        </>
      )}

      <TabTransitionContent>
      {view === "calendar" ? (
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/staff/appointments?view=calendar&year=${prev.year}&month=${prev.month}`}>
                  ← {t("previous")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/staff/appointments?view=calendar&year=${clinicToday.year}&month=${clinicToday.month}`}
                >
                  {t("today")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/staff/appointments?view=calendar&year=${next.year}&month=${next.month}`}>
                  {t("next")} →
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-400" /> {t("confirmed")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-purple-400" /> {t("checkedIn")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-400" /> {t("completed")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-400" /> {t("cancelled")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-400" /> {t("noShow")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[840px] grid-cols-7 gap-px rounded-lg border bg-border text-sm">
              {WEEKDAY_KEYS.map((key) => (
                <div key={key} className="bg-muted p-2 text-center font-medium">
                  {t(key)}
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
                          {formatAppointmentTime(appt, isRangeBookingAppointment(appt, rangeBookingNames), {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {appt.patient.name}
                        </Link>
                      ))}
                      {dayAppointments.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          {t("more", { count: dayAppointments.length - 4 })}
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
                  <TableHead>{t("patient")}</TableHead>
                  <TableHead>{t("doctor")}</TableHead>
                  <TableHead>{t("specialty")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAppointments.map((appt, index) => {
                  const { labelKey, className } = getRowDisplay(appt.status, appt.consultationStartedAt);
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
                        {appt.scheduledAt.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatAppointmentTime(appt, isRangeBookingAppointment(appt, rangeBookingNames), {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {appt.reason || t("consultation")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={className}>
                          {t(labelKey)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            href={`/staff/appointments/${appt.id}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            {t("view")}
                          </Link>
                          {appt.status === "REQUESTED" && (
                            <>
                              <form action={confirmAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-primary underline underline-offset-2"
                                >
                                  {t("confirm")}
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
                                    {t("reschedule")}
                                  </button>
                                }
                              />
                              <form action={cancelAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-destructive underline underline-offset-2"
                                >
                                  {t("cancel")}
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
                                    {t("reschedule")}
                                  </button>
                                }
                              />
                              <form action={cancelAppointment.bind(null, appt.id)}>
                                <button
                                  type="submit"
                                  className="font-medium text-destructive underline underline-offset-2"
                                >
                                  {t("cancel")}
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
                                  {t("cancel")}
                                </button>
                              </form>
                            </>
                          )}
                          {appt.status === "COMPLETED" &&
                            (appt.staffCompletedAt ? (
                              <span className="text-emerald-600">{t("checkedOut")}</span>
                            ) : (
                              <CompleteCheckoutButton appointmentId={appt.id} />
                            ))}
                          {(appt.status === "CANCELLED" || appt.status === "NO_SHOW") && (
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
      </TabTransitionContent>
    </div>
    </TabTransitionScope>
  );
}
