import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getUnreadNotificationCount } from "@/lib/notifications";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "PATIENT") {
    redirect({ href: "/login", locale });
    return;
  }

  const unreadCount = session.user.patientId
    ? await getUnreadNotificationCount(session.user.patientId)
    : 0;

  const NAV_ITEMS: NavItem[] = [
    { href: "/portal", labelKey: "home" },
    { href: "/portal/book", labelKey: "bookAppointment" },
    { href: "/portal/appointments", labelKey: "myAppointments" },
    { href: "/portal/medical-records", labelKey: "medicalRecords" },
    { href: "/portal/invoices", labelKey: "billsPayments" },
    { href: "/portal/notifications", labelKey: "notifications", badge: unreadCount },
    { href: "/portal/settings", labelKey: "profile" },
  ];

  return (
    <AppShell
      locale={locale}
      userName={session.user.name ?? ""}
      roleLabel="Patient Portal"
      navItems={NAV_ITEMS}
      contentClassName="mx-auto w-full max-w-5xl"
      sidebarDark
    >
      {children}
    </AppShell>
  );
}
