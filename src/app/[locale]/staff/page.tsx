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
import { SolidStatCard } from "@/components/solid-stat-card";
import { WeeklyAppointmentsChart } from "@/components/dashboard/weekly-appointments-chart";
import { ProfitTrendChart } from "@/components/dashboard/profit-trend-chart";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { RevenueCategoryDonut } from "@/components/dashboard/revenue-category-donut";
import { checkInAppointment } from "@/actions/appointments";
import { callWalkIn } from "@/actions/walk-ins";
import { NewAnnouncementDialog } from "@/components/staff/new-announcement-dialog";
import {
  getRangeBookingSpecialtyNames,
  isRangeBookingAppointment,
  formatAppointmentTime,
} from "@/lib/appointment-provider";

function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
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
  Waiting: "bg-amber-100 text-amber-700",
};

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ schedule?: string }>;
}) {
  const session = await auth();
  const role = session?.user.role;
  const { schedule: scheduleParam } = await searchParams;
  const scheduleTab: "today" | "upcoming" = scheduleParam === "upcoming" ? "upcoming" : "today";

  const { start: todayStart, end: todayEnd } = todayRange();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const rangeBookingNames = await getRangeBookingSpecialtyNames();
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
    upcomingAppointments,
    todayPayments,
    todayRefunds,
    pendingClaims,
    pendingLabOrders,
    completedLabToday,
    patientCount,
    activeDoctorsCount,
    sixMonthPayments,
    monthRefunds,
    sixMonthExpenses,
    weekAppointments,
    recentActivity,
    categoryInvoiceItems,
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
    role === "STAFF"
      ? prisma.appointment.findMany({
          where: { status: { in: ["REQUESTED", "CONFIRMED"] }, scheduledAt: { gte: todayEnd } },
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
      ? prisma.expense.findMany({
          where: { paidAt: { gte: sixMonthsAgo } },
          select: { amount: true, paidAt: true },
        })
      : Promise.resolve([]),
    role === "ADMIN"
      ? prisma.appointment.findMany({
          where: { scheduledAt: { gte: weekStart, lt: weekEnd } },
          select: { scheduledAt: true },
        })
      : Promise.resolve([]),
    role === "ADMIN"
      ? prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
      : Promise.resolve([]),
    role === "ADMIN"
      ? prisma.invoiceItem.findMany({
          where: { invoice: { createdAt: { gte: sixMonthsAgo }, status: { not: "UNPAID" } } },
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            clinicServiceId: true,
            invoice: { select: { pharmacySaleId: true } },
          },
        })
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

  const expensesThisMonth = sixMonthExpenses.filter((e) => e.paidAt >= monthStart);
  const monthlyExpenses = expensesThisMonth.reduce((sum, e) => sum + Number(e.amount), 0);
  const monthlyProfit = monthlyRevenue - monthlyExpenses;

  const expensesByMonth: { key: string; total: number }[] = revenueByMonth.map((m) => ({
    key: m.key,
    total: 0,
  }));
  const expenseMonthIndex = new Map(expensesByMonth.map((m, i) => [m.key, i]));
  for (const expense of sixMonthExpenses) {
    const key = `${expense.paidAt.getFullYear()}-${expense.paidAt.getMonth()}`;
    const idx = expenseMonthIndex.get(key);
    if (idx !== undefined) expensesByMonth[idx].total += Number(expense.amount);
  }
  const profitByMonth = revenueByMonth.map((m, i) => ({
    key: m.key,
    label: m.label,
    total: m.total - expensesByMonth[i].total,
  }));
  const lastMonthExpenses = expensesByMonth[expensesByMonth.length - 2]?.total ?? 0;
  const lastMonthProfit = lastMonthRevenue - lastMonthExpenses;
  const profitMonthChangePct =
    lastMonthProfit > 0 ? Math.round(((monthlyProfit - lastMonthProfit) / lastMonthProfit) * 1000) / 10 : null;

  // Buckets each billed line item into a revenue category by how it was
  // created (see ensureConsultationFeeBilled / billLabTestsToInvoice / the
  // pharmacy sale flow for these exact description prefixes) rather than a
  // dedicated category column, since none exists on InvoiceItem — negative
  // lines (e.g. "Discount") are excluded, they're not revenue.
  const categoryTotals = new Map<string, number>();
  for (const item of categoryInvoiceItems) {
    const amount = item.quantity * Number(item.unitPrice);
    if (amount <= 0) continue;
    let category: string;
    if (item.description.startsWith("Consultation — ")) category = "Consultations";
    else if (item.description.startsWith("Lab Test — ")) category = "Lab Tests";
    else if (item.invoice.pharmacySaleId) category = "Pharmacy Sales";
    else if (item.clinicServiceId) category = "Clinic Services";
    else category = "Prescriptions";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);
  }
  const revenueByCategory = [...categoryTotals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const weeklyAppointmentCounts = WEEKDAY_LABELS_MON_FIRST.map(() => 0);
  for (const appt of weekAppointments) {
    const dayIndex = Math.round(
      (clinicMidnight(appt.scheduledAt).getTime() - weekStart.getTime()) / 86400000
    );
    if (dayIndex >= 0 && dayIndex < 7) weeklyAppointmentCounts[dayIndex] += 1;
  }

  // The queue overview blends four very different record shapes (completed
  // visits, in-progress consultations — including called walk-ins, folded in
  // here since "called" is functionally the same step as "in consultation" —
  // and waiting walk-ins/bookings) into one ordered list, mirroring how the
  // front desk actually experiences "who's in the clinic right now" rather
  // than four separate queries.
  type QueueRow = {
    key: string;
    patientName: string;
    doctorName: string;
    statusLabel: "Completed" | "In Consultation" | "Waiting";
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
      (appt): QueueRow => ({
        key: `checkedin-${appt.id}`,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        statusLabel: appt.consultationStartedAt ? "In Consultation" : "Waiting",
        priority: appt.consultationStartedAt ? 1 : 3,
        sortKey: (appt.checkedInAt ?? appt.scheduledAt).getTime(),
        action: <span className="text-muted-foreground">—</span>,
      })
    ),
    ...calledWalkInsToday.map(
      (walkIn): QueueRow => ({
        key: `called-${walkIn.id}`,
        patientName: walkIn.name || "Walk-in",
        doctorName: walkIn.doctor?.user.name ?? "Any doctor",
        statusLabel: "In Consultation",
        priority: 1,
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
          <SolidStatCard
            icon={Clock}
            value={waitingTotal}
            label="Patients Waiting"
            className="bg-amber-600"
          />
          <SolidStatCard
            icon={Receipt}
            value={unpaidInvoices}
            label="Unpaid Bills"
            className="bg-rose-600"
          />
          <SolidStatCard
            icon={Pill}
            value={pendingPrescriptionsCount}
            label="Pending Prescriptions"
            className="bg-blue-600"
          />
          <SolidStatCard
            icon={PackageX}
            value={lowStock}
            label="Low Stock Alerts"
            className="bg-orange-600"
          />
          <SolidStatCard
            icon={FlaskConical}
            value={pendingLabOrders.length}
            label="Lab Orders"
            className="bg-purple-600"
          />
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
              label="Weekly Appointments"
              value={weekAppointments.length}
              className="bg-blue-600"
            />
            <SolidStatCard
              icon={Stethoscope}
              label="Active Doctors"
              value={activeDoctorsCount}
              className="bg-[#D4A03A]"
            />
            <SolidStatCard
              icon={Wallet}
              label="Monthly Profit"
              value={`MMK ${Math.round(monthlyProfit).toLocaleString()}`}
              className={monthlyProfit >= 0 ? "bg-orange-600" : "bg-rose-600"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Weekly Appointments</CardTitle>
                <span className="text-sm text-muted-foreground">Mon – Sun</span>
              </CardHeader>
              <CardContent>
                <WeeklyAppointmentsChart
                  data={WEEKDAY_LABELS_MON_FIRST.map((label, i) => ({
                    label,
                    value: weeklyAppointmentCounts[i],
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfitTrendChart data={profitByMonth} />
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className={`text-xl font-bold ${monthlyProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    MMK {Math.round(monthlyProfit).toLocaleString()}
                  </p>
                  {profitMonthChangePct !== null && (
                    <p className={`text-xs ${profitMonthChangePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {profitMonthChangePct >= 0 ? "+" : ""}
                      {profitMonthChangePct}% vs last month
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueTrendChart data={revenueByMonth} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueCategoryDonut data={revenueByCategory} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Recent Activity</CardTitle>
              <Link href="/staff/activity-log" className="text-sm underline">
                View All
              </Link>
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
              <CardHeader className="flex flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle>{scheduleTab === "today" ? "Today's Appointments" : "Upcoming Appointments"}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
                    <Link
                      href="/staff?schedule=today"
                      className={
                        scheduleTab === "today"
                          ? "rounded-md bg-card px-3 py-1 text-sm font-medium text-primary shadow-sm"
                          : "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                      }
                    >
                      Today
                    </Link>
                    <Link
                      href="/staff?schedule=upcoming"
                      className={
                        scheduleTab === "upcoming"
                          ? "rounded-md bg-card px-3 py-1 text-sm font-medium text-primary shadow-sm"
                          : "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                      }
                    >
                      Upcoming
                    </Link>
                  </div>
                  <Link href="/staff/appointments" className="text-sm underline">
                    View All
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {scheduleTab === "today" ? (
                  todaysAppointmentsAll.length === 0 ? (
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
                              {formatAppointmentTime(appt, isRangeBookingAppointment(appt, rangeBookingNames), {
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
                  )
                ) : upcomingAppointments.length === 0 ? (
                  <EmptyState icon={CalendarDays} message="No upcoming appointments booked yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingAppointments.map((appt) => (
                        <TableRow key={appt.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {appt.scheduledAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatAppointmentTime(appt, isRangeBookingAppointment(appt, rangeBookingNames), {
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
