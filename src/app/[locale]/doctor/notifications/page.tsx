import { Bell, CalendarClock, FlaskConical, Megaphone, CalendarOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { markAllStaffNotificationsRead, markStaffNotificationRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { NotificationCard } from "@/components/notifications/notification-card";
import type { StaffNotificationCategory } from "@prisma/client";

const PILL_TAB_LIST = "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

const CATEGORY_META: Partial<
  Record<StaffNotificationCategory, { labelKey: "appointments" | "labResults" | "announcements" | "leaveRequests"; icon: typeof Bell; badgeClass: string }>
> = {
  APPOINTMENT: { labelKey: "appointments", icon: CalendarClock, badgeClass: "bg-blue-100 text-blue-700" },
  LAB_RESULT: { labelKey: "labResults", icon: FlaskConical, badgeClass: "bg-emerald-100 text-emerald-700" },
  ANNOUNCEMENT: { labelKey: "announcements", icon: Megaphone, badgeClass: "bg-purple-100 text-purple-700" },
  LEAVE: { labelKey: "leaveRequests", icon: CalendarOff, badgeClass: "bg-orange-100 text-orange-700" },
};

export default async function DoctorNotificationsPage() {
  const session = await requirePageRole(["DOCTOR"]);
  const t = await getTranslations("staffNotifications");
  const now = new Date();

  const notifications = await prisma.staffNotification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const byCategory = (category: StaffNotificationCategory) =>
    notifications.filter((n) => n.category === category);

  const categories = Object.keys(CATEGORY_META) as StaffNotificationCategory[];
  const cardMeta = (category: StaffNotificationCategory) => {
    const found = CATEGORY_META[category];
    const Icon = found?.icon ?? Bell;
    return {
      label: found ? t(found.labelKey) : category,
      badgeClass: found?.badgeClass ?? "bg-muted text-muted-foreground",
      icon: <Icon className="size-4" />,
    };
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{t("unreadSummary", { count: unreadCount })}</span>
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllStaffNotificationsRead}>
            <Button type="submit" variant="link" className="h-auto p-0">
              {t("markAllRead")}
            </Button>
          </form>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="all" className={PILL_TAB_TRIGGER}>
            {t("all")}
            {unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category} className={PILL_TAB_TRIGGER}>
              {t(CATEGORY_META[category]!.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4 grid gap-3">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} message={t("noNotifications")} />
          ) : (
            notifications.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                now={now}
                meta={cardMeta(n.category)}
                markRead={markStaffNotificationRead}
              />
            ))
          )}
        </TabsContent>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="mt-4 grid gap-3">
            {byCategory(category).length === 0 ? (
              <EmptyState icon={CATEGORY_META[category]!.icon} message={t("nothingHere")} />
            ) : (
              byCategory(category).map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  now={now}
                  meta={cardMeta(category)}
                  markRead={markStaffNotificationRead}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
