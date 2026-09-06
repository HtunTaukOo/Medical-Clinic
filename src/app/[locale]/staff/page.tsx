import type { ReactNode } from "react";
import {
  Receipt,
  PackageX,
  Pill,
  Clock,
  Wallet,
  ShieldAlert,
  FlaskConical,
  ListOrdered,
  AlertTriangle,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
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
import { clinicLocalMinutes, formatClinicDateTime } from "@/lib/clinic-hours";
import { StatTile } from "@/components/stat-tile";
import { checkInAppointment } from "@/actions/appointments";
import { callWalkIn } from "@/actions/walk-ins";
import { NewAnnouncementDialog } from "@/components/staff/new-announcement-dialog";

function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
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
  const t = await getTranslations();
  const role = session?.user.role;

  const { start: todayStart, end: todayEnd } = todayRange();

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
  const now = new Date();
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            icon={Wallet}
            value={todayRevenue.toFixed(2)}
            label="Revenue Today"
            color="emerald"
          />
          <StatTile
            icon={ShieldAlert}
            value={pendingClaimsCount}
            label="Claims to Review"
            color="rose"
          />
          <StatTile icon={PackageX} value={lowStock} label={t("inventory.lowStock")} color="amber" />
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
