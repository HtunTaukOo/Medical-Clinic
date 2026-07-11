import type { LucideIcon } from "lucide-react";
import {
  Users,
  CalendarDays,
  Receipt,
  PackageX,
  ShieldCheck,
  Stethoscope,
  Pill,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getDisplayFirstName } from "@/lib/format";
import { HeroBanner } from "@/components/hero-banner";
import { StatTile } from "@/components/stat-tile";

const ROLE_ICON: Record<string, LucideIcon> = {
  ADMIN: ShieldCheck,
  DOCTOR: Stethoscope,
  RECEPTIONIST: CalendarDays,
  PHARMACIST: Pill,
};

const OUTLINE_ON_PRIMARY =
  "border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground";

export default async function StaffDashboardPage() {
  const session = await auth();
  const t = await getTranslations();
  const role = session?.user.role;
  const doctorId = session?.user.doctorId;

  const [
    patientCount,
    upcomingAppointmentsClinicWide,
    upcomingAppointmentsMine,
    unpaidInvoices,
    medicines,
    pendingPrescriptions,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count({
      where: { scheduledAt: { gte: new Date() }, status: { in: ["REQUESTED", "CONFIRMED"] } },
    }),
    role === "DOCTOR" && doctorId
      ? prisma.appointment.count({
          where: {
            doctorId,
            scheduledAt: { gte: new Date() },
            status: { in: ["REQUESTED", "CONFIRMED"] },
          },
        })
      : Promise.resolve(0),
    prisma.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.medicine.findMany({ select: { stockQty: true, reorderLevel: true } }),
    prisma.prescription.count({ where: { fulfilled: false } }),
  ]);
  const lowStock = medicines.filter(
    (m: { stockQty: number; reorderLevel: number }) => m.stockQty <= m.reorderLevel
  ).length;
  const upcomingAppointments =
    role === "DOCTOR" ? upcomingAppointmentsMine : upcomingAppointmentsClinicWide;

  const firstName = session?.user.name ? getDisplayFirstName(session.user.name) : "";

  let subtitle = "";
  if (role === "ADMIN") {
    subtitle = `${patientCount} patient${patientCount === 1 ? "" : "s"} • ${unpaidInvoices} unpaid invoice${unpaidInvoices === 1 ? "" : "s"}`;
  } else if (role === "RECEPTIONIST") {
    subtitle = `${upcomingAppointmentsClinicWide} upcoming appointment${upcomingAppointmentsClinicWide === 1 ? "" : "s"} across the clinic`;
  } else if (role === "DOCTOR") {
    subtitle = `${upcomingAppointmentsMine} upcoming appointment${upcomingAppointmentsMine === 1 ? "" : "s"} for you`;
  } else if (role === "PHARMACIST") {
    subtitle = `${pendingPrescriptions} prescription${pendingPrescriptions === 1 ? "" : "s"} pending fulfillment`;
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
            {role === "DOCTOR" && (
              <Button asChild variant="secondary">
                <Link href="/staff/appointments">{t("appointments.title")}</Link>
              </Button>
            )}
            {role === "PHARMACIST" && (
              <Button asChild variant="secondary">
                <Link href="/staff/inventory">{t("inventory.title")}</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} value={patientCount} label={t("patients.title")} color="blue" />
        <StatTile
          icon={CalendarDays}
          value={upcomingAppointments}
          label={t("appointments.title")}
          color="emerald"
        />
        <StatTile
          icon={Receipt}
          value={unpaidInvoices}
          label={t("billing.invoices")}
          color="purple"
        />
        <StatTile
          icon={PackageX}
          value={lowStock}
          label={t("inventory.lowStock")}
          color="amber"
        />
      </div>
    </div>
  );
}
