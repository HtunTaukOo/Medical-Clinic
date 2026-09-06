import type { ReactNode } from "react";
import {
  Receipt,
  PackageX,
  Pill,
  Clock,
  Wallet,
  FlaskConical,
  ListOrdered,
  AlertTriangle,
  Users,
  CalendarDays,
  Stethoscope,
  UserPlus,
  CheckCircle2,
  History,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { todayRange } from "@/lib/queue";
import { getExpiryStatus } from "@/lib/inventory";
import { getDisplayFirstName } from "@/lib/format";
import { clinicLocalMinutes, clinicMidnight, clinicWeekday, formatClinicDateTime } from "@/lib/clinic-hours";
import { MONTH_NAMES } from "@/lib/reports";
import { StatTile } from "@/components/stat-tile";
import { checkInAppointment } from "@/actions/appointments";
import { callWalkIn } from "@/actions/walk-ins";
import { NewAnnouncementDialog } from "@/components/staff/new-announcement-dialog";

function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}

function SolidStatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  className: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl p-5 text-white ${className}`}>
      <div>
        <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="size-5" />
      </div>
    </div>
  );
}

const WEEKDAY_LABELS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function activityMeta(action: string): { icon: React.ComponentType<{ className?: string }>; className: string } {
  const lower = action.toLowerCase();
  if (lower.includes("payment") || lower.includes("invoice")) {
    return { icon: Wallet, className: "bg-emerald-100 text-emerald-600" };
  }
  if (lower.includes("stock") || lower.includes("expir")) {
    return { icon: AlertTriangle, className: "bg-rose-100 text-rose-600" };
  }
  if (lower.includes("registered") || lower.includes("created staff") || lower.includes("account")) {
    return { icon: UserPlus, className: "bg-purple-100 text-purple-600" };
  }
  if (lower.includes("confirm") || lower.includes("complete")) {
    return { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-600" };
  }
  if (lower.includes("appointment") || lower.includes("booked") || lower.includes("checked in")) {
    return { icon: CalendarDays, className: "bg-blue-100 text-blue-600" };
  }
  return { icon: History, className: "bg-slate-100 text-slate-600" };
}

const LAB_STATUS_LABEL: Record<string, string> = {
  ORDERED: "Awaiting collection",
  SAMPLE_COLLECTED: "Awaiting results",
};

const LAB_STATUS_CLASS: Record<string, string> = {
  ORDERED: "bg-amber-100 text-amber-700",
  SAMPLE_COLLECTED: "bg-blue-100 text-blue-700",
};

const APPT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const APPT_STATUS_CLASS: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-indigo-100 text-indigo-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-orange-100 text-orange-700",
};

const QUEUE_STATUS_CLASS: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700",
  "In Consultation": "bg-purple-100 text-purple-700",
  Called: "bg-blue-100 text-blue-700",
  Waiting: "bg-amber-100 text-amber-700",
};

export default async function StaffDashboardPage() {
  const session = await auth();
  const role = session?.user.role;

  const { start: todayStart, end: todayEnd } = todayRange();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const mondayOffsetDays = (clinicWeekday(now) + 6) % 7;
  const weekStart = new Date(clinicMidnight(now).getTime() - mondayOffsetDays * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [
    unpaidInvoices,
    medicines,
    pendingPrescriptions,
    waitingAppointments,
    waitingWalkIns,
    checkedInAppointmentsToday,
    calledWalkInsToday,
    completedAppointmentsToday,
    todaysAppointmentsAll,
    todayPayments,
    todayRefunds,
    pendingClaims,
    pendingLabOrders,
    completedLabToday,
    patientCount,
    activeDoctorsCount,
    todaysAppointmentCountAdmin,
    sixMonthPayments,
    monthRefunds,
    weekAppointments,
    recentActivity,
  ] = await Promise.all([
    prisma.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.medicine.findMany({
      select: { id: true, name: true, unit: true, stockQty: true, reorderLevel: true, expiryDate: true },
    }),
    role === "STAFF"
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
    role === "STAFF"
      ? prisma.appointment.findMany({
          where: { status: "CONFIRMED", scheduledAt: { gte: todayStart, lt: todayEnd } },
          include: { patient: true, doctor: { include: { user: true } } },
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.walkIn.findMany({
          where: { status: "WAITING", createdAt: { gte: todayStart, lt: todayEnd } },
          include: { doctor: { include: { user: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.appointment.findMany({
          where: { status: "CHECKED_IN", scheduledAt: { gte: todayStart, lt: todayEnd } },
          include: { patient: true, doctor: { include: { user: true } } },
          orderBy: { checkedInAt: "asc" },
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.walkIn.findMany({
          where: { status: "CALLED", createdAt: { gte: todayStart, lt: todayEnd } },
          include: { doctor: { include: { user: true } } },
          orderBy: { calledAt: "asc" },
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.appointment.findMany({
          where: { status: "COMPLETED", scheduledAt: { gte: todayStart, lt: todayEnd } },
          include: { patient: true, doctor: { include: { user: true } } },
          orderBy: { scheduledAt: "desc" },
          take: 2,
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.appointment.findMany({
          where: { scheduledAt: { gte: todayStart, lt: todayEnd } },
          include: { patient: true, doctor: { include: { user: true } } },
          orderBy: { scheduledAt: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
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
      ? prisma.insuranceClaim.findMany({
          where: { status: "SUBMITTED" },
          include: { patient: true },
          orderBy: { submittedAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.labOrder.findMany({
          where: { status: { in: ["ORDERED", "SAMPLE_COLLECTED"] } },
          include: { patient: true, items: { include: { labTest: true } } },
          orderBy: { createdAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    role === "STAFF"
      ? prisma.labOrder.count({
          where: { status: "COMPLETED", completedAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve(0),
    role === "ADMIN" ? prisma.patient.count() : Promise.resolve(0),
    role === "ADMIN"
      ? prisma.doctorProfile.count({ where: { user: { active: true } } })
      : Promise.resolve(0),
    role === "ADMIN"
      ? prisma.appointment.count({ where: { scheduledAt: { gte: todayStart, lt: todayEnd } } })
      : Promise.resolve(0),
    role === "ADMIN"
      ? prisma.payment.findMany({
          where: { paidAt: { gte: sixMonthsAgo } },
          select: { amount: true, paidAt: true },
        })
      : Promise.resolve([]),
    role === "ADMIN"
      ? prisma.refund.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: monthStart } },
        })
      : Promise.resolve({ _sum: { amount: null as unknown as number | null } }),
    role === "ADMIN"
      ? prisma.appointment.findMany({
          where: { scheduledAt: { gte: weekStart, lt: weekEnd } },
          select: { scheduledAt: true },
        })
      : Promise.resolve([]),
    role === "ADMIN"
      ? prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
      : Promise.resolve([]),
  ]);

  const lowStockMedicines = medicines
    .filter((m) => m.stockQty <= m.reorderLevel)
    .sort((a, b) => a.stockQty - b.stockQty);
  const lowStock = lowStockMedicines.length;
  const attentionMedicines = medicines
    .filter((m) => m.stockQty <= m.reorderLevel || getExpiryStatus(m.expiryDate) !== null)
    .slice(0, 5);

  const todayRevenue =
    Number(todayPayments._sum.amount ?? 0) - Number(todayRefunds._sum.amount ?? 0);
  const waitingToCheckInCount = waitingAppointments.length;
  const walkInsWaitingCount = waitingWalkIns.length;
  const waitingTotal = waitingToCheckInCount + walkInsWaitingCount;
  const pendingPrescriptionsCount = pendingPrescriptions.length;
  const pendingClaimsCount = pendingClaims.length;

  const paymentsThisMonth = sixMonthPayments.filter((p) => p.paidAt >= monthStart);
  const monthlyRevenue =
    paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0) -
    Number(monthRefunds._sum.amount ?? 0);

  const revenueByMonth: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueByMonth.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_NAMES[d.getMonth()], total: 0 });
  }
  const revenueMonthIndex = new Map(revenueByMonth.map((m, i) => [m.key, i]));
  for (const payment of sixMonthPayments) {
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    const idx = revenueMonthIndex.get(key);
    if (idx !== undefined) revenueByMonth[idx].total += Number(payment.amount);
  }
  const lastMonthRevenue = revenueByMonth[revenueByMonth.length - 2]?.total ?? 0;
  const revenueMonthChangePct =
    lastMonthRevenue > 0 ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10 : null;

  const weeklyAppointmentCounts = WEEKDAY_LABELS_MON_FIRST.map(() => 0);
  for (const appt of weekAppointments) {
    const dayIndex = Math.round(
      (clinicMidnight(appt.scheduledAt).getTime() - weekStart.getTime()) / 86400000
    );
    if (dayIndex >= 0 && dayIndex < 7) weeklyAppointmentCounts[dayIndex] += 1;
  }

  // The queue overview blends four very different record shapes (completed
  // visits, in-progress consultations, called and waiting walk-ins/bookings)
  // into one ordered list, mirroring how the front desk actually experiences
  // "who's in the clinic right now" rather than four separate queries.
  type QueueRow = {
    key: string;
    patientName: string;
    doctorName: string;
    statusLabel: "Completed" | "In Consultation" | "Called" | "Waiting";
    priority: number;
    sortKey: number;
    action: ReactNode;
  };

  const queueRows: QueueRow[] = [
    ...completedAppointmentsToday.map(
      (appt): QueueRow => ({
        key: `done-${appt.id}`,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        statusLabel: "Completed",
        priority: 0,
        sortKey: appt.scheduledAt.getTime(),
        action: <span className="text-muted-foreground">—</span>,
      })
    ),
    ...checkedInAppointmentsToday.map(
      (appt, index): QueueRow => ({
        key: `checkedin-${appt.id}`,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        statusLabel: index === 0 ? "In Consultation" : "Waiting",
        priority: index === 0 ? 1 : 3,
        sortKey: (appt.checkedInAt ?? appt.scheduledAt).getTime(),
        action: <span className="text-muted-foreground">—</span>,
      })
    ),
    ...calledWalkInsToday.map(
      (walkIn): QueueRow => ({
        key: `called-${walkIn.id}`,
        patientName: walkIn.name || "Walk-in",
        doctorName: walkIn.doctor?.user.name ?? "Any doctor",
        statusLabel: "Called",
        priority: 2,
        sortKey: (walkIn.calledAt ?? walkIn.createdAt).getTime(),
        action: (
          <Link href={`/staff/queue/walk-ins/${walkIn.id}`} className="font-medium text-primary underline">
            Start
          </Link>
        ),
      })
    ),
    ...waitingAppointments.map(
      (appt): QueueRow => ({
        key: `confirmed-${appt.id}`,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        statusLabel: "Waiting",
        priority: 3,
        sortKey: appt.scheduledAt.getTime(),
        action: (
          <form action={checkInAppointment.bind(null, appt.id)}>
            <button type="submit" className="font-medium text-primary underline">
              Check In
            </button>
          </form>
        ),
      })
    ),
    ...waitingWalkIns.map(
      (walkIn): QueueRow => ({
        key: `waitingwalkin-${walkIn.id}`,
        patientName: walkIn.name || "Walk-in",
        doctorName: walkIn.doctor?.user.name ?? "Any doctor",
        statusLabel: "Waiting",
        priority: 3,
        sortKey: walkIn.createdAt.getTime(),
        action: (
          <form action={callWalkIn.bind(null, walkIn.id)}>
            <button type="submit" className="font-medium text-primary underline">
              Call In
            </button>
          </form>
        ),
      })
    ),
  ]
    .sort((a, b) => a.priority - b.priority || a.sortKey - b.sortKey)
    .slice(0, 5);

  const firstName = session?.user.name ? getDisplayFirstName(session.user.name) : "";
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
            {role === "ADMIN" ? (
              <>
                <Num>{todayRevenue.toFixed(2)}</Num> revenue today · <Num>{pendingClaimsCount}</Num>{" "}
                claim{pendingClaimsCount === 1 ? "" : "s"} to review
              </>
            ) : (
              <>
                <Num>{waitingTotal}</Num> waiting · <Num>{pendingPrescriptionsCount}</Num>{" "}
                prescription{pendingPrescriptionsCount === 1 ? "" : "s"} pending ·{" "}
                <Num>{pendingLabOrders.length}</Num> lab order{pendingLabOrders.length === 1 ? "" : "s"}{" "}
                open
              </>
            )}
          </p>
        </div>
        <NewAnnouncementDialog />
      </div>

      {role === "STAFF" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile icon={Clock} value={waitingTotal} label="Patients Waiting" color="amber" />
          <StatTile icon={Receipt} value={unpaidInvoices} label="Unpaid Bills" color="rose" />
          <StatTile
            icon={Pill}
            value={pendingPrescriptionsCount}
            label="Pending Prescriptions"
            color="blue"
          />
          <StatTile icon={PackageX} value={lowStock} label="Low Stock Alerts" color="amber" />
          <StatTile icon={FlaskConical} value={pendingLabOrders.length} label="Lab Orders" color="purple" />
        </div>
      )}

      {role === "ADMIN" && (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SolidStatCard
              icon={Users}
              label="Total Patients"
              value={patientCount.toLocaleString()}
              className="bg-violet-600"
            />
            <SolidStatCard
              icon={CalendarDays}
              label="Today's Appointments"
              value={todaysAppointmentCountAdmin}
              className="bg-blue-600"
            />
            <SolidStatCard
              icon={Stethoscope}
              label="Active Doctors"
              value={activeDoctorsCount}
              className="bg-emerald-600"
            />
            <SolidStatCard
              icon={Wallet}
              label="Monthly Revenue"
              value={`K ${Math.round(monthlyRevenue).toLocaleString()}`}
              className="bg-orange-600"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Weekly Appointments</CardTitle>
                <span className="text-sm text-muted-foreground">Mon – Sun</span>
              </CardHeader>
              <CardContent>
                <div className="flex h-48 items-end gap-3">
                  {(() => {
                    const max = Math.max(1, ...weeklyAppointmentCounts);
                    return WEEKDAY_LABELS_MON_FIRST.map((label, i) => (
                      <div key={label} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-medium text-primary">
                          {weeklyAppointmentCounts[i]}
                        </span>
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t-md bg-primary"
                            style={{
                              height: `${Math.max(2, (weeklyAppointmentCounts[i] / max) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium">{label}</span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-32 items-end gap-3">
                  {(() => {
                    const max = Math.max(1, ...revenueByMonth.map((m) => m.total));
                    return revenueByMonth.map((m) => (
                      <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t-md bg-emerald-500"
                            style={{ height: `${Math.max(2, (m.total / max) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{m.label}</span>
                      </div>
                    ));
                  })()}
                </div>
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className="text-xl font-bold text-emerald-600">
                    K {Math.round(monthlyRevenue).toLocaleString()}
                  </p>
                  {revenueMonthChangePct !== null && (
                    <p className={`text-xs ${revenueMonthChangePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {revenueMonthChangePct >= 0 ? "+" : ""}
                      {revenueMonthChangePct}% vs last month
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="grid gap-3">
                  {recentActivity.map((entry) => {
                    const meta = activityMeta(entry.action);
                    const Icon = meta.icon;
                    return (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm">
                            {entry.action}
                            {entry.target ? ` — ${entry.target}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {role === "STAFF" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Queue Overview</CardTitle>
              <Link href="/staff/queue" className="text-sm underline">
                View All
              </Link>
            </CardHeader>
            <CardContent>
              {queueRows.length === 0 ? (
                <EmptyState icon={ListOrdered} message="No one in the queue right now." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Queue #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueRows.map((row, index) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium text-primary">
                          #{String(index + 1).padStart(2, "0")}
                        </TableCell>
                        <TableCell>{row.patientName}</TableCell>
                        <TableCell className="text-muted-foreground">{row.doctorName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={QUEUE_STATUS_CLASS[row.statusLabel]}>
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Today&apos;s Appointments</CardTitle>
                <Link href="/staff/appointments" className="text-sm underline">
                  View All
                </Link>
              </CardHeader>
              <CardContent>
                {todaysAppointmentsAll.length === 0 ? (
                  <EmptyState icon={Clock} message="No appointments scheduled today." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todaysAppointmentsAll.map((appt) => (
                        <TableRow key={appt.id}>
                          <TableCell>
                            {appt.scheduledAt.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/staff/patients/${appt.patientId}`}
                              className="underline underline-offset-2"
                            >
                              {appt.patient.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {appt.doctor.user.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={APPT_STATUS_CLASS[appt.status]}>
                              {APPT_STATUS_LABEL[appt.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <CardTitle>Laboratory Overview</CardTitle>
                  {completedLabToday > 0 && (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                      {completedLabToday} today
                    </Badge>
                  )}
                </div>
                <Link href="/staff/lab" className="text-sm underline">
                  View All
                </Link>
              </CardHeader>
              <CardContent>
                {pendingLabOrders.length === 0 ? (
                  <EmptyState icon={FlaskConical} message="No pending lab orders." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Test(s)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingLabOrders.slice(0, 5).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Link
                              href={`/staff/lab/${order.id}`}
                              className="underline underline-offset-2"
                            >
                              {order.patient.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.items.map((item) => item.labTest.name).join(", ")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={LAB_STATUS_CLASS[order.status]}>
                              {LAB_STATUS_LABEL[order.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Pending Prescriptions</CardTitle>
                <Link href="/staff/inventory" className="text-sm underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="grid gap-2">
                {pendingPrescriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prescriptions pending.</p>
                ) : (
                  pendingPrescriptions.slice(0, 5).map((rx) => {
                    const isPaid = !rx.appointment || rx.appointment.invoice?.status === "PAID";
                    return (
                      <Link
                        key={rx.id}
                        href={`/staff/patients/${rx.patientId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{rx.patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rx.items.map((item) => item.medicine.name).join(", ")}
                          </p>
                        </div>
                        <Badge variant={isPaid ? "success" : "destructive"}>
                          {isPaid ? "Ready" : "Unpaid"}
                        </Badge>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {lowStockMedicines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Stock levels look fine.</p>
                ) : (
                  lowStockMedicines.slice(0, 5).map((medicine) => (
                    <Link
                      key={medicine.id}
                      href={`/staff/inventory/${medicine.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
                    >
                      <div>
                        <p className="font-medium">{medicine.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {medicine.stockQty} {medicine.unit} remaining
                        </p>
                      </div>
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {role === "ADMIN" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Insurance Claims</CardTitle>
              <Link href="/staff/billing/claims" className="text-sm underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {pendingClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claims pending review.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Claimed Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingClaims.slice(0, 5).map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell>{claim.patient.name}</TableCell>
                        <TableCell>{Number(claim.claimedAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/staff/billing/${claim.invoiceId}`}
                            className="font-medium text-primary underline"
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Inventory Attention</CardTitle>
              <Link href="/staff/inventory" className="text-sm underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {attentionMedicines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Stock levels look fine.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionMedicines.map((medicine) => {
                      const expiry = getExpiryStatus(medicine.expiryDate);
                      const label =
                        medicine.stockQty <= medicine.reorderLevel
                          ? "Low stock"
                          : expiry === "expired"
                            ? "Expired"
                            : "Expiring soon";
                      return (
                        <TableRow key={medicine.id}>
                          <TableCell>{medicine.name}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">{label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/staff/inventory/${medicine.id}`}
                              className="font-medium text-primary underline"
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
