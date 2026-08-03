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
    waitingNowMine,
    myPatientsSeen,
    pendingLabOrdersMine,
    waitingToCheckIn,
    walkInsWaiting,
    checkedInNow,
    todayPayments,
    todayRefunds,
    staffClockedIn,
    pendingClaims,
    openPurchaseOrders,
    awaitingCollection,
    awaitingResults,
    completedToday,
  ] = await Promise.all([
    prisma.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.medicine.findMany({ select: { stockQty: true, reorderLevel: true, expiryDate: true } }),
    prisma.prescription.count({ where: { fulfilled: false } }),
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
      ? prisma.appointment.count({ where: { doctorId, status: "CHECKED_IN" } })
      : Promise.resolve(0),
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
      ? prisma.appointment.count({
          where: { status: "CONFIRMED", scheduledAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve(0),
    role === "RECEPTIONIST"
      ? prisma.walkIn.count({ where: { status: "WAITING", createdAt: { gte: todayStart, lt: todayEnd } } })
      : Promise.resolve(0),
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
      ? prisma.insuranceClaim.count({ where: { status: "SUBMITTED" } })
      : Promise.resolve(0),
    role === "PHARMACIST"
      ? prisma.purchaseOrder.count({ where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } } })
      : Promise.resolve(0),
    role === "LAB_TECH"
      ? prisma.labOrder.count({ where: { status: "ORDERED" } })
      : Promise.resolve(0),
    role === "LAB_TECH"
      ? prisma.labOrder.count({ where: { status: "SAMPLE_COLLECTED" } })
      : Promise.resolve(0),
    role === "LAB_TECH"
      ? prisma.labOrder.count({
          where: { status: "COMPLETED", completedAt: { gte: todayStart, lt: todayEnd } },
        })
      : Promise.resolve(0),
  ]);

  const lowStock = medicines.filter((m) => m.stockQty <= m.reorderLevel).length;
  const expiringOrExpired = medicines.filter((m) => getExpiryStatus(m.expiryDate) !== null).length;
  const myPatientsCount = myPatientsSeen.length;
  const todayRevenue =
    Number(todayPayments._sum.amount ?? 0) - Number(todayRefunds._sum.amount ?? 0);
  const waitingTotal = waitingToCheckIn + walkInsWaiting;

  const firstName = session?.user.name ? getDisplayFirstName(session.user.name) : "";

  let subtitle = "";
  if (role === "ADMIN") {
    subtitle = `${staffClockedIn} staff on shift • ${todayRevenue.toFixed(2)} revenue today`;
  } else if (role === "RECEPTIONIST") {
    subtitle = `${waitingTotal} waiting • ${checkedInNow} in queue now`;
  } else if (role === "DOCTOR") {
    subtitle = `${todaysAppointmentsMine} appointment${todaysAppointmentsMine === 1 ? "" : "s"} today`;
  } else if (role === "PHARMACIST") {
    subtitle = `${pendingPrescriptions} prescription${pendingPrescriptions === 1 ? "" : "s"} pending fulfillment`;
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
            <StatTile icon={Clock} value={waitingNowMine} label="Waiting Now" color="amber" />
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
            <StatTile icon={Clock} value={waitingToCheckIn} label="Waiting to Check In" color="amber" />
            <StatTile icon={Megaphone} value={walkInsWaiting} label="Walk-ins Waiting" color="orange" />
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
              value={pendingPrescriptions}
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
              value={pendingClaims}
              label="Claims to Review"
              color="rose"
            />
            <StatTile icon={PackageX} value={lowStock} label={t("inventory.lowStock")} color="amber" />
          </>
        )}
      </div>
    </div>
  );
}
