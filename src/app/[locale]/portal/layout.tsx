import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";

const NAV_ITEMS: NavItem[] = [
  { href: "/portal", labelKey: "dashboard" },
  { href: "/portal/doctors", labelKey: "findDoctors" },
  { href: "/portal/appointments", labelKey: "myAppointments" },
  { href: "/portal/records", labelKey: "medicalRecords" },
  { href: "/portal/invoices", labelKey: "myInvoices" },
];

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

  return (
    <AppShell
      locale={locale}
      userName={session.user.name ?? ""}
      roleLabel="Patient Portal"
      navItems={NAV_ITEMS}
    >
      {children}
    </AppShell>
  );
}
