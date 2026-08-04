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
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { getDisplayFirstName } from "@/lib/format";
import { todayRange } from "@/lib/queue";
import { getExpiryStatus } from "@/lib/inventory";
import { HeroBanner } from "@/components/hero-banner";
import { StatTile } from "@/components/stat-tile";

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
    todaysAppointmentsMine,
    upNextMine,
    myPatientsSeen,
    pendingLabOrdersMine,
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
      ? prisma.appointment.count({
          where: {
            doctorId,
            scheduledAt: { gte: todayStart, lt: todayEnd },
            status: { not: "CANCELLED" },
          },
        })
      : Promise.resolve(0),
    role === "DOCTOR" && doctorId
      ? prisma.appointment.findMany({
          where: { doctorId, status: "CHECKED_IN" },
          include: { patient: true },
          orderBy: { checkedInAt: "asc" },
        })
      : Promise.resolve([]),
    role === "DOCTOR" && doctorId
      ? prisma.appointment.findMany({
          where: { doctorId, status: "COMPLETED" },
          distinct: ["patientId"],
          select: { patientId: true },
        })
      : Promise.resolve([]),
    role === "DOCTOR" && doctorId
      ? prisma.labOrder.count({
          where: { doctorId, status: { in: ["ORDERED", "SAMPLE_COLLECTED"] } },
        })
      : Promise.resolve(0),
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
  const myPatientsCount = myPatientsSeen.length;
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

  let subtitle = "";
  if (role === "ADMIN") {
    subtitle = `${staffClockedIn} staff on shift • ${todayRevenue.toFixed(2)} revenue today`;
  } else if (role === "RECEPTIONIST") {
    subtitle = `${waitingTotal} waiting • ${checkedInNow} in queue now`;
  } else if (role === "DOCTOR") {
    subtitle = `${todaysAppointmentsMine} appointment${todaysAppointmentsMine === 1 ? "" : "s"} today`;
  } else if (role === "PHARMACIST") {
    subtitle = `${pendingPrescriptionsCount} prescription${pendingPrescriptionsCount === 1 ? "" : "s"} pending fulfillment`;
  } else if (role === "LAB_TECH") {
    subtitle = `${awaitingCollection} awaiting collection • ${awaitingResults} awaiting results`;
  }

  return (
    <div className="grid gap-6">
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
            {role === "DOCTOR" && (
              <>
                <Button asChild variant="secondary">
                  <Link href="/staff/appointments">{t("appointments.title")}</Link>
                </Button>
                <Button asChild variant="outline" className={OUTLINE_ON_PRIMARY}>
                  <Link href="/staff/queue">{t("nav.queue")}</Link>
                </Button>
              </>
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
        {role === "DOCTOR" && (
          <>
            <StatTile icon={Users} value={myPatientsCount} label="My Patients" color="blue" />
            <StatTile
              icon={CalendarDays}
              value={todaysAppointmentsMine}
              label="Today's Appointments"
              color="emerald"
            />
            <StatTile icon={Clock} value={upNextMine.length} label="Waiting Now" color="amber" />
            <StatTile
              icon={TestTube}
              value={pendingLabOrdersMine}
              label="Pending Lab Results"
              color="purple"
            />
          </>
        )}
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

      {role === "DOCTOR" && (
        <Card>
          <CardHeader>
            <CardTitle>Up Next</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {upNextMine.length === 0 ? (
              <EmptyState icon={Clock} message="No one waiting right now." />
            ) : (
              upNextMine.map((appt) => (
                <Link
                  key={appt.id}
                  href={`/staff/appointments/${appt.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <p className="font-medium">{appt.patient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {appt.checkedInAt &&
                      `Checked in at ${appt.checkedInAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
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
                    <Badge variant={isPaid ? "default" : "destructive"}>
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
