import type { LucideIcon } from "lucide-react";
import {
  Users,
  CalendarDays,
  Receipt,
  PackageX,
  ShieldCheck,
  Stethoscope,
  Pill,
  Clock,
  Wallet,
  UserCheck,
  ShieldAlert,
  Truck,
  CalendarClock,
  FlaskConical,
  TestTube,
  CheckCircle2,
  Megaphone,
  AlertTriangle,
  Siren,
  Activity,
  ChevronRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { getDisplayFirstName, initials, calculateAge, formatRelativeTime } from "@/lib/format";
import { todayRange } from "@/lib/queue";
import { getExpiryStatus } from "@/lib/inventory";
import { getVitalsAlertMessage } from "@/lib/clinical-alerts";
import { HeroBanner } from "@/components/hero-banner";
import { StatTile } from "@/components/stat-tile";
import { AppointmentRow, AVATAR_COLORS, GENDER_LETTER } from "@/components/appointments/appointment-row";

const ROLE_ICON: Record<string, LucideIcon> = {
  ADMIN: ShieldCheck,
  DOCTOR: Stethoscope,
  RECEPTIONIST: CalendarDays,
  PHARMACIST: Pill,
  LAB_TECH: FlaskConical,
};

const OUTLINE_ON_PRIMARY =
  "border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground";

const LAB_STATUS_LABEL: Record<string, string> = {
  ORDERED: "Awaiting collection",
  SAMPLE_COLLECTED: "Awaiting results",
};

const LAB_RESULT_LABEL: Record<string, string> = {
  HIGH: "elevated",
  LOW: "low",
  BORDERLINE: "borderline",
};

export default async function StaffDashboardPage() {
  const session = await auth();
  const t = await getTranslations();
  const role = session?.user.role;
  const doctorId = session?.user.doctorId;

  const { start: todayStart, end: todayEnd } = todayRange();

  const [
    unpaidInvoices,
    medicines,
    pendingPrescriptions,
    todaysAppointmentsFull,
    recentAbnormalLabResults,
    waitingAppointments,
    waitingWalkIns,
    checkedInNow,
    todayPayments,
    todayRefunds,
    staffClockedIn,
    pendingClaims,
    openPurchaseOrders,
    pendingLabOrders,
    completedToday,
  ] = await Promise.all([
    prisma.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.medicine.findMany({
      select: { id: true, name: true, stockQty: true, reorderLevel: true, expiryDate: true },
    }),
    role === "PHARMACIST"
      ? prisma.prescription.findMany({
          where: { fulfilled: false },
          include: {
            patient: true,
            items: { include: { medicine: true } },
            appointment: { include: { invoice: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    role === "DOCTOR" && doctorId
      ? prisma.appointment.findMany({
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
        })
      : Promise.resolve([]),
    role === "DOCTOR" && doctorId
      ? prisma.labOrderItem.findMany({
          where: {
            labOrder: { doctorId, status: "COMPLETED" },
            resultStatus: { in: ["HIGH", "LOW", "BORDERLINE"] },
          },
          include: { labTest: true, labOrder: { include: { patient: true } } },
          orderBy: { resultEnteredAt: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
    role === "RECEPTIONIST"
      ? prisma.appointment.findMany({
          where: { status: "CONFIRMED", scheduledAt: { gte: todayStart, lt: todayEnd } },
          include: { patient: true, doctor: { include: { user: true } } },
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    role === "RECEPTIONIST"
      ? prisma.walkIn.findMany({
          where: { status: "WAITING", createdAt: { gte: todayStart, lt: todayEnd } },
          include: { doctor: { include: { user: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    role === "RECEPTIONIST"
      ? prisma.appointment.count({
          where: { status: "CHECKED_IN", scheduledAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve(0),
    role === "ADMIN"
      ? prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve({ _sum: { amount: null as unknown as number | null } }),
    role === "ADMIN"
      ? prisma.refund.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve({ _sum: { amount: null as unknown as number | null } }),
    role === "ADMIN"
      ? prisma.attendanceRecord.count({
          where: { clockOut: null, clockIn: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve(0),
    role === "ADMIN"
      ? prisma.insuranceClaim.findMany({
          where: { status: "SUBMITTED" },
          include: { patient: true },
          orderBy: { submittedAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    role === "PHARMACIST"
      ? prisma.purchaseOrder.count({ where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } } })
      : Promise.resolve(0),
    role === "LAB_TECH"
      ? prisma.labOrder.findMany({
          where: { status: { in: ["ORDERED", "SAMPLE_COLLECTED"] } },
          include: { patient: true, items: { include: { labTest: true } } },
          orderBy: { createdAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    role === "LAB_TECH"
      ? prisma.labOrder.count({
          where: { status: "COMPLETED", completedAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve(0),
  ]);

  const lowStock = medicines.filter((m) => m.stockQty <= m.reorderLevel).length;
  const expiringOrExpired = medicines.filter((m) => getExpiryStatus(m.expiryDate) !== null).length;
  const attentionMedicines = medicines
    .filter((m) => m.stockQty <= m.reorderLevel || getExpiryStatus(m.expiryDate) !== null)
    .slice(0, 5);
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

  const todayRevenue =
    Number(todayPayments._sum.amount ?? 0) - Number(todayRefunds._sum.amount ?? 0);
  const waitingToCheckInCount = waitingAppointments.length;
  const walkInsWaitingCount = waitingWalkIns.length;
  const waitingTotal = waitingToCheckInCount + walkInsWaitingCount;
  const pendingPrescriptionsCount = pendingPrescriptions.length;
  const pendingClaimsCount = pendingClaims.length;
  const awaitingCollection = pendingLabOrders.filter((o) => o.status === "ORDERED").length;
  const awaitingResults = pendingLabOrders.filter((o) => o.status === "SAMPLE_COLLECTED").length;

  type WaitingRow =
    | { kind: "appointment"; appointment: (typeof waitingAppointments)[number]; sortKey: number }
    | { kind: "walkin"; walkIn: (typeof waitingWalkIns)[number]; sortKey: number };
  const mergedWaiting: WaitingRow[] = [
    ...waitingAppointments.map(
      (appointment): WaitingRow => ({
        kind: "appointment",
        appointment,
        sortKey: appointment.scheduledAt.getTime(),
      })
    ),
    ...waitingWalkIns.map(
      (walkIn): WaitingRow => ({ kind: "walkin", walkIn, sortKey: walkIn.createdAt.getTime() })
    ),
  ]
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 5);

  const firstName = session?.user.name ? getDisplayFirstName(session.user.name) : "";
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  let subtitle = "";
  if (role === "ADMIN") {
    subtitle = `${staffClockedIn} staff on shift • ${todayRevenue.toFixed(2)} revenue today`;
  } else if (role === "RECEPTIONIST") {
    subtitle = `${waitingTotal} waiting • ${checkedInNow} in queue now`;
  } else if (role === "DOCTOR") {
    subtitle = `You have ${todaysAppointmentsFull.length} appointment${todaysAppointmentsFull.length === 1 ? "" : "s"} scheduled today.`;
  } else if (role === "PHARMACIST") {
    subtitle = `${pendingPrescriptionsCount} prescription${pendingPrescriptionsCount === 1 ? "" : "s"} pending fulfillment`;
  } else if (role === "LAB_TECH") {
    subtitle = `${awaitingCollection} awaiting collection • ${awaitingResults} awaiting results`;
  }

  return (
    <div className="grid gap-6">
      {role !== "DOCTOR" && (
      <>
      <HeroBanner
        name={firstName}
        subtitle={subtitle}
        icon={role ? ROLE_ICON[role] : undefined}
        actions={
          <>
            {(role === "ADMIN" || role === "RECEPTIONIST") && (
              <>
                <Button asChild variant="secondary">
                  <Link href="/staff/patients/new">{t("patients.new")}</Link>
                </Button>
                <Button asChild variant="outline" className={OUTLINE_ON_PRIMARY}>
                  <Link href="/staff/appointments/new">{t("appointments.new")}</Link>
                </Button>
              </>
            )}
            {role === "RECEPTIONIST" && (
              <Button asChild variant="outline" className={OUTLINE_ON_PRIMARY}>
                <Link href="/staff/queue">{t("nav.queue")}</Link>
              </Button>
            )}
            {role === "ADMIN" && (
              <Button asChild variant="outline" className={OUTLINE_ON_PRIMARY}>
                <Link href="/staff/reports">{t("nav.reports")}</Link>
              </Button>
            )}
            {role === "PHARMACIST" && (
              <>
                <Button asChild variant="secondary">
                  <Link href="/staff/inventory">{t("inventory.title")}</Link>
                </Button>
                <Button asChild variant="outline" className={OUTLINE_ON_PRIMARY}>
                  <Link href="/staff/inventory/purchase-orders">
                    {t("inventory.purchaseOrders")}
                  </Link>
                </Button>
              </>
            )}
            {role === "LAB_TECH" && (
              <Button asChild variant="secondary">
                <Link href="/staff/lab">{t("nav.lab")}</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {role === "RECEPTIONIST" && (
          <>
            <StatTile
              icon={Clock}
              value={waitingToCheckInCount}
              label="Waiting to Check In"
              color="amber"
            />
            <StatTile icon={Megaphone} value={walkInsWaitingCount} label="Walk-ins Waiting" color="orange" />
            <StatTile icon={Users} value={checkedInNow} label="In Queue Now" color="blue" />
            <StatTile
              icon={Receipt}
              value={unpaidInvoices}
              label={t("billing.invoices")}
              color="purple"
            />
          </>
        )}
        {role === "PHARMACIST" && (
          <>
            <StatTile
              icon={Pill}
              value={pendingPrescriptionsCount}
              label="Pending Prescriptions"
              color="blue"
            />
            <StatTile icon={PackageX} value={lowStock} label={t("inventory.lowStock")} color="amber" />
            <StatTile
              icon={CalendarClock}
              value={expiringOrExpired}
              label="Expiring / Expired"
              color="rose"
            />
            <StatTile
              icon={Truck}
              value={openPurchaseOrders}
              label="Open Purchase Orders"
              color="purple"
            />
          </>
        )}
        {role === "LAB_TECH" && (
          <>
            <StatTile
              icon={TestTube}
              value={awaitingCollection}
              label="Awaiting Collection"
              color="amber"
            />
            <StatTile
              icon={FlaskConical}
              value={awaitingResults}
              label="Awaiting Results"
              color="blue"
            />
            <StatTile
              icon={CheckCircle2}
              value={completedToday}
              label="Completed Today"
              color="emerald"
            />
          </>
        )}
        {role === "ADMIN" && (
          <>
            <StatTile
              icon={Wallet}
              value={todayRevenue.toFixed(2)}
              label="Revenue Today"
              color="emerald"
            />
            <StatTile icon={UserCheck} value={staffClockedIn} label="Staff on Shift" color="blue" />
            <StatTile
              icon={ShieldAlert}
              value={pendingClaimsCount}
              label="Claims to Review"
              color="rose"
            />
            <StatTile icon={PackageX} value={lowStock} label={t("inventory.lowStock")} color="amber" />
          </>
        )}
      </div>
      </>
      )}

      {role === "DOCTOR" && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {now.toLocaleDateString(undefined, {
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
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  href={
                    inProgressAppt
                      ? `/staff/appointments/${inProgressAppt.id}`
                      : "/staff/consultations"
                  }
                >
                  <Activity className="size-4" />
                  Start Consultation
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/staff/schedule">
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
                        <p className="text-xs text-red-700/70 dark:text-red-300/70">
                          {alert.timeLabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="destructive">
                    <Link href={`/staff/appointments/${alert.appointmentId}`}>View</Link>
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
                        <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                          {alert.timeLabel}
                        </p>
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
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">{todaysAppointmentsFull.length}</p>
                  <p className="text-sm font-medium">Today&apos;s Total</p>
                  <p className="text-xs text-muted-foreground">appointments</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <CalendarDays className="size-4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{waitingAppts.length}</p>
                  <p className="text-sm font-medium">Waiting</p>
                  <p className="text-xs text-muted-foreground">patients in queue</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Clock className="size-4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{inProgressAppt ? 1 : 0}</p>
                  <p className="text-sm font-medium">In Progress</p>
                  <p className="text-xs text-muted-foreground">active consultation</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Activity className="size-4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-indigo-600">{completedAppts.length}</p>
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-xs text-muted-foreground">consultations today</p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <CheckCircle2 className="size-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Today&apos;s Schedule</CardTitle>
                <Link href="/staff/appointments" className="text-sm underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="grid gap-2">
                {todaysAppointmentsFull.length === 0 ? (
                  <EmptyState icon={CalendarDays} message="No appointments scheduled today." />
                ) : (
                  todaysAppointmentsFull.map((appt, index) => {
                    const isInProgress = inProgressAppt?.id === appt.id;
                    const isWaiting = waitingAppts.some((a) => a.id === appt.id);
                    const isUrgent = redAlerts.some((a) => a.appointmentId === appt.id);
                    const age = calculateAge(appt.patient.dob);
                    const genderLetter = appt.patient.gender
                      ? GENDER_LETTER[appt.patient.gender]
                      : null;
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
                        href={`/staff/appointments/${appt.id}`}
                        time={appt.scheduledAt.toLocaleTimeString([], {
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
                              <AvatarFallback
                                className={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                              >
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
                            <Link href={`/staff/appointments/${appt.id}`}>
                              {isInProgress ? "Resume" : "Start"}
                            </Link>
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1">
                  {[
                    { icon: Pill, label: "New Prescription", href: "/staff/prescriptions" },
                    { icon: Users, label: "View Patients", href: "/staff/patients" },
                    { icon: CalendarClock, label: "My Schedule", href: "/staff/schedule" },
                  ].map(({ icon: Icon, label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{label}</span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {role === "RECEPTIONIST" && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Waiting Room</CardTitle>
            <Link href="/staff/queue" className="text-sm underline">
              View full queue
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2">
            {mergedWaiting.length === 0 ? (
              <EmptyState icon={Clock} message="No one waiting." />
            ) : (
              mergedWaiting.map((row) =>
                row.kind === "appointment" ? (
                  <Link
                    key={`appt-${row.appointment.id}`}
                    href={`/staff/patients/${row.appointment.patientId}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Booked</Badge>
                      <p className="font-medium">{row.appointment.patient.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.appointment.scheduledAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      — {row.appointment.doctor.user.name}
                    </p>
                  </Link>
                ) : (
                  <Link
                    key={`walkin-${row.walkIn.id}`}
                    href="/staff/queue"
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">#{row.walkIn.tokenNumber}</Badge>
                      <p className="font-medium">{row.walkIn.name || "Walk-in"}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.walkIn.doctor ? row.walkIn.doctor.user.name : "Any doctor"}
                    </p>
                  </Link>
                )
              )
            )}
          </CardContent>
        </Card>
      )}

      {role === "PHARMACIST" && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Pending Prescriptions</CardTitle>
            <Link href="/staff/inventory" className="text-sm underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pendingPrescriptions.length === 0 ? (
              <EmptyState icon={Pill} message="No prescriptions pending." />
            ) : (
              pendingPrescriptions.slice(0, 5).map((rx) => {
                const isPaid = rx.appointment.invoice?.status === "PAID";
                return (
                  <Link
                    key={rx.id}
                    href={`/staff/patients/${rx.patientId}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{rx.patient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {rx.items.map((item) => item.medicine.name).join(", ")}
                      </p>
                    </div>
                    <Badge variant={isPaid ? "success" : "destructive"}>
                      {isPaid ? "Ready to fulfill" : "Payment required"}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {role === "LAB_TECH" && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Pending Lab Orders</CardTitle>
            <Link href="/staff/lab" className="text-sm underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pendingLabOrders.length === 0 ? (
              <EmptyState icon={TestTube} message="No pending lab orders." />
            ) : (
              pendingLabOrders.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/staff/lab/${order.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{order.patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items.map((item) => item.labTest.name).join(", ")}
                    </p>
                  </div>
                  <Badge variant="outline">{LAB_STATUS_LABEL[order.status]}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Insurance claims</p>
                <Link href="/staff/billing/claims" className="text-sm underline">
                  View all
                </Link>
              </div>
              {pendingClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claims pending review.</p>
              ) : (
                pendingClaims.slice(0, 5).map((claim) => (
                  <Link
                    key={claim.id}
                    href={`/staff/billing/${claim.invoiceId}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <p className="font-medium">{claim.patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(claim.claimedAmount).toFixed(2)}
                    </p>
                  </Link>
                ))
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Inventory</p>
                <Link href="/staff/inventory" className="text-sm underline">
                  View all
                </Link>
              </div>
              {attentionMedicines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Stock levels look fine.</p>
              ) : (
                attentionMedicines.map((medicine) => {
                  const expiry = getExpiryStatus(medicine.expiryDate);
                  const label =
                    medicine.stockQty <= medicine.reorderLevel
                      ? "Low stock"
                      : expiry === "expired"
                        ? "Expired"
                        : "Expiring soon";
                  return (
                    <Link
                      key={medicine.id}
                      href={`/staff/inventory/${medicine.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <p className="font-medium">{medicine.name}</p>
                      <Badge variant="destructive">{label}</Badge>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
