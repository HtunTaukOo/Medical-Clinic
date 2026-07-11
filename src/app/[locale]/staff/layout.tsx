import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { STAFF_ROLES } from "@/lib/authz";
import { AppShell, type NavItem } from "@/components/app-shell";

const ALL_NAV_ITEMS: (NavItem & { roles: string[] })[] = [
  { href: "/staff", labelKey: "dashboard", roles: STAFF_ROLES },
  {
    href: "/staff/patients",
    labelKey: "patients",
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
  },
  {
    href: "/staff/appointments",
    labelKey: "appointments",
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
  },
  {
    href: "/staff/queue",
    labelKey: "queue",
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
  },
  {
    href: "/staff/billing",
    labelKey: "billing",
    roles: ["ADMIN", "RECEPTIONIST"],
  },
  {
    href: "/staff/inventory",
    labelKey: "inventory",
    roles: ["ADMIN", "PHARMACIST"],
  },
  { href: "/staff/users", labelKey: "staff", roles: ["ADMIN"] },
  { href: "/staff/settings", labelKey: "settings", roles: ["ADMIN"] },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin Console",
  DOCTOR: "Doctor Console",
  RECEPTIONIST: "Front Desk",
  PHARMACIST: "Pharmacy Console",
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
  const navItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <AppShell
      locale={locale}
      userName={session.user.name ?? ""}
      roleLabel={ROLE_LABELS[role] ?? "Staff"}
      navItems={navItems}
    >
      {children}
    </AppShell>
  );
}
