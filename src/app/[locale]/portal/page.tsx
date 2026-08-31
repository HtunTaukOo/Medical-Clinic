import {
  CalendarClock,
  Pill,
  Receipt,
  Phone,
  Plus,
  ClipboardList,
  History,
  Megaphone,
  HeartPulse,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clinicLocalMinutes,
  formatClinicDateTime,
  formatTime,
  getClinicSettings,
  isWithinOpeningHours,
} from "@/lib/clinic-hours";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { ClinicLogo } from "@/components/clinic-logo";
import { getDisplayFirstName, initials } from "@/lib/format";
import { getQueuePosition, isWithinSelfCheckInWindow } from "@/lib/queue";
import { checkInAppointment, cancelAppointment } from "@/actions/appointments";

const CATEGORY_STYLES: Record<string, { bg: string; badge: string; text: string }> = {
  Cardiology: { bg: "bg-blue-500", badge: "bg-blue-600", text: "text-blue-600" },
  Supplement: { bg: "bg-orange-500", badge: "bg-orange-600", text: "text-orange-600" },
  Gastro: { bg: "bg-amber-500", badge: "bg-amber-600", text: "text-amber-700" },
  Diabetes: { bg: "bg-purple-500", badge: "bg-purple-600", text: "text-purple-600" },
  "Pain Relief": { bg: "bg-rose-500", badge: "bg-rose-600", text: "text-rose-600" },
  General: { bg: "bg-slate-500", badge: "bg-slate-600", text: "text-slate-600" },
};

const ANNOUNCEMENT_BADGE_STYLES: Record<string, string> = {
  Hours: "bg-blue-100 text-blue-700",
  "New Service": "bg-emerald-100 text-emerald-700",
  Closure: "bg-orange-100 text-orange-700",
  General: "bg-slate-100 text-slate-700",
};

function formatK(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function PortalDashboardPage() {
  const session = await auth();
  const t = await getTranslations();
  const patientId = session?.user.patientId;

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    settings,
    upcomingAppointments,
    weekAppointmentCount,
    prescriptions,
    unpaidInvoices,
    lastVisit,
    featuredMedicines,
    announcements,
  ] = await Promise.all([
    getClinicSettings(),
    patientId
      ? prisma.appointment.findMany({
          where: {
            patientId,
            OR: [
              { scheduledAt: { gte: now }, status: { in: ["REQUESTED", "CONFIRMED"] } },
              { status: "CHECKED_IN" },
            ],
          },
          orderBy: { scheduledAt: "asc" },
          take: 3,
          include: { doctor: { include: { user: true } } },
        })
      : [],
    patientId
      ? prisma.appointment.count({
          where: {
            patientId,
            scheduledAt: { gte: now, lte: weekEnd },
            status: { in: ["REQUESTED", "CONFIRMED", "CHECKED_IN"] },
          },
        })
      : 0,
    patientId
      ? prisma.prescription.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: { items: { include: { medicine: true } } },
        })
      : [],
    patientId
      ? prisma.invoice.findMany({
          where: { patientId, status: { in: ["UNPAID", "PARTIAL"] } },
          orderBy: { createdAt: "desc" },
        })
      : [],
    patientId
      ? prisma.appointment.findFirst({
          where: { patientId, status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          include: { doctor: { include: { user: true } } },
        })
      : null,
    prisma.medicine.findMany({ where: { featured: true }, orderBy: { name: "asc" } }),
    prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const activePrescriptions = prescriptions.filter((rx) => {
    const maxDuration = Math.max(0, ...rx.items.map((i) => i.durationDays ?? 0));
    if (maxDuration === 0) return false;
    const start = rx.fulfilledAt ?? rx.createdAt;
    return start.getTime() + maxDuration * 86400000 > now.getTime();
  });
  const renewalsDue = activePrescriptions.filter((rx) => {
    const maxDuration = Math.max(0, ...rx.items.map((i) => i.durationDays ?? 0));
    const start = rx.fulfilledAt ?? rx.createdAt;
    const end = start.getTime() + maxDuration * 86400000;
    return end - now.getTime() < 7 * 86400000;
  });
  const recentPrescription = prescriptions[0];

  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const nextUnpaidInvoice = unpaidInvoices[0];

  const firstName = session?.user.name ? getDisplayFirstName(session.user.name) : "";
  const clinicName = t("app.name");
  const openNow = settings.isOpen && isWithinOpeningHours(now, settings.openingTime, settings.closingTime);
  const mapsUrl = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null;

  const greeting = getGreeting(Math.floor(clinicLocalMinutes(now) / 60));
  const dateLabel = formatClinicDateTime(now, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-mid via-primary to-navy p-6 text-white shadow-sm sm:p-8">
        <HeartPulse
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 -right-10 size-56 -translate-y-1/2 text-white/5"
        />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div className="flex items-center gap-4">
            <ClinicLogo className="size-16 shrink-0 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.25)]" />
            <div className="grid gap-2">
              <Badge
                className={
                  openNow
                    ? "w-fit gap-1.5 border-emerald-300/30 bg-emerald-500/20 text-emerald-300"
                    : "w-fit gap-1.5 border-red-300/30 bg-red-500/20 text-red-300"
                }
              >
                <span className={`size-1.5 rounded-full ${openNow ? "bg-emerald-400" : "bg-red-400"}`} />
                {openNow ? "Open Now" : "Closed Now"}
              </Badge>
              <h1 className="text-2xl font-bold">{clinicName}</h1>
              <p className="text-sm text-white/80">
                Hours today: {formatTime(settings.openingTime)} – {formatTime(settings.closingTime)}
              </p>
              {settings.phones.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
                  {settings.phones.map((phone) => (
                    <span key={phone} className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {phone}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {mapsUrl && (
            <div className="flex shrink-0 flex-col gap-2 sm:w-48">
              <Button
                asChild
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  Get Directions
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Featured Health Products */}
      {featuredMedicines.length > 0 && (
        <div className="grid gap-3">
          <div>
            <p className="font-semibold">Featured Health Products</p>
            <p className="text-sm text-muted-foreground">Curated by {clinicName} Pharmacy</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featuredMedicines.map((m) => {
              const style = CATEGORY_STYLES[m.category ?? "General"] ?? CATEGORY_STYLES.General;
              return (
                <Card key={m.id} className="w-56 shrink-0 overflow-hidden py-0">
                  <div className={`relative flex h-24 items-center justify-center ${style.bg}`}>
                    <Pill className="size-10 text-white/90" />
                    <span
                      className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium text-white ${style.badge}`}
                    >
                      {m.category ?? "General"}
                    </span>
                  </div>
                  <CardContent className="grid gap-1 pb-4">
                    <p className="font-semibold">{m.name}</p>
                    {m.brand && <p className="text-xs text-muted-foreground">{m.brand}</p>}
                    {m.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                    )}
                    <p className={`text-sm font-semibold ${style.text}`}>
                      {formatK(Number(m.price))} / {m.unit}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Greeting + Quick Book */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          <h2 className="text-2xl font-bold">
            {greeting}, {firstName} 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            You have <span className="font-medium text-foreground">{weekAppointmentCount}</span>{" "}
            upcoming appointment{weekAppointmentCount === 1 ? "" : "s"} this week.
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/book">
            <Plus className="size-4" />
            Quick Book
          </Link>
        </Button>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none bg-blue-50 shadow-none dark:bg-blue-950/40">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {upcomingAppointments.length}
              </p>
              <p className="text-sm text-blue-900/70 dark:text-blue-100/70">Upcoming Appointments</p>
              {upcomingAppointments[0] && (
                <p className="mt-1 text-xs text-blue-900/60 dark:text-blue-100/60">
                  Next: {new Date(upcomingAppointments[0].scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              )}
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <CalendarClock className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-emerald-50 shadow-none dark:bg-emerald-950/40">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {activePrescriptions.length}
              </p>
              <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70">Active Prescriptions</p>
              {renewalsDue.length > 0 && (
                <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-100/60">
                  {renewalsDue.length} renewal{renewalsDue.length === 1 ? "" : "s"} due
                </p>
              )}
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <ClipboardList className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-orange-50 shadow-none dark:bg-orange-950/40">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {unpaidInvoices.length}
              </p>
              <p className="text-sm text-orange-900/70 dark:text-orange-100/70">Unpaid Bills</p>
              {unpaidTotal > 0 && (
                <p className="mt-1 text-xs text-orange-900/60 dark:text-orange-100/60">
                  {formatK(unpaidTotal)} due
                </p>
              )}
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white">
              <Receipt className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-purple-50 shadow-none dark:bg-purple-950/40">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {lastVisit ? new Date(lastVisit.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
              </p>
              <p className="text-sm text-purple-900/70 dark:text-purple-100/70">Last Visit</p>
              {lastVisit && (
                <p className="mt-1 text-xs text-purple-900/60 dark:text-purple-100/60">
                  {lastVisit.doctor.user.name}
                </p>
              )}
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white">
              <History className="size-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments + Announcements */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <Card>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Upcoming Appointments</p>
                <Link href="/portal/appointments" className="text-sm underline">
                  View all
                </Link>
              </div>
              {upcomingAppointments.length === 0 && (
                <EmptyState icon={CalendarClock} message={t("appointments.noResults")} />
              )}
              {await Promise.all(
                upcomingAppointments.map(async (appt) => {
                  const position =
                    appt.status === "CHECKED_IN" && appt.checkedInAt
                      ? await getQueuePosition(appt.doctorId, appt.checkedInAt)
                      : undefined;
                  const canSelfCheckIn =
                    appt.status === "CONFIRMED" && isWithinSelfCheckInWindow(appt.scheduledAt);
                  const canCancel = appt.status === "REQUESTED" || appt.status === "CONFIRMED";
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
                            {formatClinicDateTime(appt.scheduledAt, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            <br />
                            {formatClinicDateTime(appt.scheduledAt, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                        <div className="mt-1 flex justify-end gap-2">
                          {canSelfCheckIn && (
                            <form action={checkInAppointment.bind(null, appt.id)}>
                              <Button size="sm" type="submit">
                                {t("appointments.checkIn")}
                              </Button>
                            </form>
                          )}
                          {canCancel && (
                            <form action={cancelAppointment.bind(null, appt.id)}>
                              <Button size="sm" variant="destructive" type="submit">
                                {t("appointments.cancel")}
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {(recentPrescription || nextUnpaidInvoice) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentPrescription && (
                <Link href="/portal/medical-records">
                  <Card className="border-none bg-emerald-50 shadow-none dark:bg-emerald-950/40">
                    <CardContent className="grid gap-0.5">
                      <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                        Recent Rx
                      </p>
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">
                        {recentPrescription.items[0]?.medicine.name ?? "Prescription"}
                      </p>
                      <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70">
                        {recentPrescription.items[0]
                          ? `${recentPrescription.items[0].dosage} · ${recentPrescription.fulfilled ? "Fulfilled" : "Pending"}`
                          : recentPrescription.fulfilled
                            ? "Fulfilled"
                            : "Pending"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {nextUnpaidInvoice && (
                <Link href={`/portal/invoices/${nextUnpaidInvoice.id}`}>
                  <Card className="border-none bg-orange-50 shadow-none dark:bg-orange-950/40">
                    <CardContent className="grid gap-0.5">
                      <p className="text-xs font-semibold tracking-wide text-orange-700 uppercase dark:text-orange-300">
                        Unpaid Bill
                      </p>
                      <p className="font-medium text-orange-900 dark:text-orange-100">
                        Invoice · {new Date(nextUnpaidInvoice.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-orange-900/70 dark:text-orange-100/70">
                        {formatK(Number(nextUnpaidInvoice.total))} · Due
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          )}
        </div>

        <Card>
          <CardContent className="grid gap-3">
            <p className="font-semibold">Clinic Announcements</p>
            {announcements.length === 0 ? (
              <EmptyState icon={Megaphone} message="No announcements right now." />
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ANNOUNCEMENT_BADGE_STYLES[a.category] ?? ANNOUNCEMENT_BADGE_STYLES.General}`}
                    >
                      {a.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
