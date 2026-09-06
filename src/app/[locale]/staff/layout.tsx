import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { STAFF_ROLES, homeForRole } from "@/lib/authz";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getUnreadStaffNotificationCount } from "@/lib/notifications";

const ALL_NAV_ITEMS: (NavItem & { roles: string[] })[] = [
  { href: "/staff", labelKey: "dashboard", roles: STAFF_ROLES, group: "sectionOverview" },
  {
    href: "/staff/check-in",
    labelKey: "checkIn",
    roles: ["STAFF"],
    group: "sectionCare",
  },
  {
    href: "/staff/patients",
    labelKey: "patients",
    roles: ["STAFF"],
    group: "sectionCare",
  },
  {
    href: "/staff/appointments",
    labelKey: "appointments",
    roles: ["ADMIN", "STAFF"],
    group: "sectionCare",
  },
  {
    href: "/staff/queue",
    labelKey: "queue",
    roles: ["STAFF"],
    group: "sectionCare",
  },
  {
    href: "/staff/pharmacy",
    labelKey: "pharmacy",
    roles: ["STAFF"],
    group: "sectionOperations",
  },
  {
    href: "/staff/inventory",
    labelKey: "inventory",
    roles: ["STAFF"],
    group: "sectionOperations",
  },
  {
    href: "/staff/lab",
    labelKey: "lab",
    roles: ["STAFF"],
    group: "sectionOperations",
  },
  { href: "/staff/users", labelKey: "staff", roles: ["ADMIN"], group: "sectionAdmin" },
  {
    href: "/staff/doctors",
    labelKey: "doctorsSchedules",
    roles: ["ADMIN"],
    group: "sectionAdmin",
  },
  {
    href: "/staff/clinic-services",
    labelKey: "clinicServices",
    roles: ["ADMIN"],
    group: "sectionAdmin",
  },
  {
    href: "/staff/billing",
    labelKey: "billing",
    roles: ["ADMIN", "STAFF"],
    group: "sectionOperations",
  },
  { href: "/staff/reports", labelKey: "reports", roles: ["ADMIN"], group: "sectionAdmin" },
  {
    href: "/staff/activity-log",
    labelKey: "activityLog",
    roles: [],
    group: "sectionAdmin",
  },
  { href: "/staff/settings", labelKey: "settings", roles: ["ADMIN"], group: "sectionAdmin" },
  {
    href: "/staff/notifications",
    labelKey: "notifications",
    roles: ["STAFF"],
    group: "sectionAdmin",
  },
  {
    href: "/staff/profile",
    labelKey: "profile",
    roles: ["STAFF"],
    group: "sectionAdmin",
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin Console",
  STAFF: "Staff Console",
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

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return;
  }
  if (!STAFF_ROLES.includes(session.user.role)) {
    redirect({ href: homeForRole(session.user.role), locale });
    return;
  }

  const role = session.user.role;
  const unreadNotifications = await getUnreadStaffNotificationCount(session.user.id);
  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) =>
    item.labelKey === "notifications" && unreadNotifications > 0
      ? { ...item, badge: unreadNotifications }
      : item
  );

  return (
    <AppShell
      locale={locale}
      userName={session.user.name ?? ""}
      roleLabel={ROLE_LABELS[role] ?? "Staff"}
      navItems={navItems}
      sidebarDark
      hideSectionLabels
    >
      {children}
    </AppShell>
  );
}
