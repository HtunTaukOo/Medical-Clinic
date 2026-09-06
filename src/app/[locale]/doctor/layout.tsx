import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { homeForRole } from "@/lib/authz";
import { AppShell, type NavItem } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { todayRange } from "@/lib/queue";
import { getUnreadStaffNotificationCount } from "@/lib/notifications";

const DOCTOR_NAV_ITEMS: NavItem[] = [
  { href: "/doctor", labelKey: "dashboard" },
  { href: "/doctor/appointments", labelKey: "appointments" },
  { href: "/doctor/patients", labelKey: "myPatients" },
  { href: "/doctor/consultations", labelKey: "consultations" },
  { href: "/doctor/prescriptions", labelKey: "prescriptions" },
  { href: "/doctor/schedule", labelKey: "schedule" },
  { href: "/doctor/notifications", labelKey: "notifications" },
  { href: "/doctor/profile", labelKey: "profile" },
];

export default async function DoctorLayout({
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
  if (session.user.role !== "DOCTOR") {
    redirect({ href: homeForRole(session.user.role), locale });
    return;
  }

  const doctorId = session.user.doctorId;
  const { start: todayStart, end: todayEnd } = todayRange();
  const consultationsBadge = doctorId
    ? await prisma.appointment.count({
        where: {
          doctorId,
          status: "CHECKED_IN",
          scheduledAt: { gte: todayStart, lt: todayEnd },
        },
      })
    : 0;

  const unreadNotifications = await getUnreadStaffNotificationCount(session.user.id);

  const navItems = DOCTOR_NAV_ITEMS.map((item) => {
    if (item.labelKey === "consultations" && consultationsBadge > 0) {
      return { ...item, badge: consultationsBadge };
    }
    if (item.labelKey === "notifications" && unreadNotifications > 0) {
      return { ...item, badge: unreadNotifications };
    }
    return item;
  });

  return (
    <AppShell
      locale={locale}
      userName={session.user.name ?? ""}
      roleLabel="Doctor Console"
      navItems={navItems}
      sidebarDark
      hideSectionLabels
    >
      {children}
    </AppShell>
  );
}
