import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { STAFF_ROLES } from "@/lib/authz";
import { AppShell, type NavItem } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { todayRange } from "@/lib/queue";

const ALL_NAV_ITEMS: (NavItem & { roles: string[] })[] = [
  { href: "/staff", labelKey: "dashboard", roles: STAFF_ROLES, group: "sectionOverview" },
  {
    href: "/staff/patients",
    labelKey: "patients",
    roles: ["ADMIN", "RECEPTIONIST"],
    group: "sectionCare",
  },
  {
    href: "/staff/appointments",
    labelKey: "appointments",
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
    group: "sectionCare",
  },
  {
    href: "/staff/patients",
    labelKey: "myPatients",
    roles: ["DOCTOR"],
    group: "sectionCare",
  },
  {
    href: "/staff/consultations",
    labelKey: "consultations",
    roles: ["DOCTOR"],
    group: "sectionCare",
  },
  {
    href: "/staff/prescriptions",
    labelKey: "prescriptions",
    roles: ["DOCTOR"],
    group: "sectionCare",
  },
  {
    href: "/staff/schedule",
    labelKey: "schedule",
    roles: ["DOCTOR"],
    group: "sectionCare",
  },
  {
    href: "/staff/queue",
    labelKey: "queue",
    roles: ["ADMIN", "RECEPTIONIST"],
    group: "sectionCare",
  },
  {
    href: "/staff/attendance",
    labelKey: "attendance",
    roles: STAFF_ROLES,
    group: "sectionOperations",
  },
  {
    href: "/staff/billing",
    labelKey: "billing",
    roles: ["ADMIN", "RECEPTIONIST"],
    group: "sectionOperations",
  },
  {
    href: "/staff/inventory",
    labelKey: "inventory",
    roles: ["ADMIN", "PHARMACIST"],
    group: "sectionOperations",
  },
  {
    href: "/staff/lab",
    labelKey: "lab",
    roles: ["ADMIN", "LAB_TECH"],
    group: "sectionOperations",
  },
  { href: "/staff/users", labelKey: "staff", roles: ["ADMIN"], group: "sectionAdmin" },
  { href: "/staff/reports", labelKey: "reports", roles: ["ADMIN"], group: "sectionAdmin" },
  {
    href: "/staff/announcements",
    labelKey: "announcements",
    roles: ["ADMIN", "RECEPTIONIST"],
    group: "sectionAdmin",
  },
  {
    href: "/staff/activity-log",
    labelKey: "activityLog",
    roles: ["ADMIN"],
    group: "sectionAdmin",
  },
  { href: "/staff/settings", labelKey: "settings", roles: ["ADMIN"], group: "sectionAdmin" },
  { href: "/staff/profile", labelKey: "profile", roles: ["DOCTOR"], group: "sectionAdmin" },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin Console",
  DOCTOR: "Doctor Console",
  RECEPTIONIST: "Front Desk",
  PHARMACIST: "Pharmacy Console",
  LAB_TECH: "Lab Console",
};

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    redirect({ href: "/login", locale });
    return;
  }

  const role = session.user.role;
  const isDoctor = role === "DOCTOR";
  const doctorId = session.user.doctorId;

  const { start: todayStart, end: todayEnd } = todayRange();
  const consultationsBadge =
    isDoctor && doctorId
      ? await prisma.appointment.count({
          where: {
            doctorId,
            status: "CHECKED_IN",
            scheduledAt: { gte: todayStart, lt: todayEnd },
          },
        })
      : 0;

  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) =>
    item.labelKey === "consultations" && consultationsBadge > 0
      ? { ...item, badge: consultationsBadge }
      : item
  );

  return (
    <AppShell
      locale={locale}
      userName={session.user.name ?? ""}
      roleLabel={ROLE_LABELS[role] ?? "Staff"}
      navItems={navItems}
      sidebarDark={isDoctor}
      contentClassName={isDoctor ? "mx-auto w-full max-w-5xl" : undefined}
    >
      {children}
    </AppShell>
  );
}
