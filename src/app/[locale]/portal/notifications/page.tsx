import {
  Bell,
  CalendarClock,
  FlaskConical,
  Pill,
  Megaphone,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ensurePrescriptionRenewalNotifications } from "@/lib/notifications";
import { markAllNotificationsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import type { NotificationCategory, NotificationTone } from "@prisma/client";

const PILL_TAB_LIST = "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

const CATEGORY_META: Record<NotificationCategory, { label: string; icon: typeof Bell; badgeClass: string }> = {
  APPOINTMENT: { label: "Appointments", icon: CalendarClock, badgeClass: "bg-blue-100 text-blue-700" },
  LAB_RESULT: { label: "Results", icon: FlaskConical, badgeClass: "bg-emerald-100 text-emerald-700" },
  PRESCRIPTION: { label: "Prescriptions", icon: Pill, badgeClass: "bg-orange-100 text-orange-700" },
  DIAGNOSIS: { label: "Diagnoses", icon: Stethoscope, badgeClass: "bg-rose-100 text-rose-700" },
  ANNOUNCEMENT: { label: "Announcements", icon: Megaphone, badgeClass: "bg-purple-100 text-purple-700" },
};

const TONE_ICON_CLASS: Record<NotificationTone, string> = {
  INFO: "bg-blue-100 text-blue-600",
  SUCCESS: "bg-emerald-100 text-emerald-600",
  WARNING: "bg-amber-100 text-amber-600",
};

function formatRelativeTime(date: Date, now: Date) {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function NotificationCard({
  notification,
  now,
}: {
  notification: {
    id: string;
    category: NotificationCategory;
    tone: NotificationTone;
    title: string;
    body: string;
    href: string | null;
    read: boolean;
    createdAt: Date;
  };
  now: Date;
}) {
  const meta = CATEGORY_META[notification.category];
  const Icon = notification.tone === "SUCCESS" ? CheckCircle2 : meta.icon;
  const content = (
    <div
      className={`relative flex items-start gap-3 rounded-xl border p-4 transition-colors ${
        notification.read ? "border-border bg-white" : "border-blue-100 bg-blue-50/60 hover:bg-blue-50"
      }`}
    >
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_CLASS[notification.tone]}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{notification.title}</p>
        <p className="text-sm text-muted-foreground">{notification.body}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge className={meta.badgeClass}>{meta.label}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(notification.createdAt, now)}
          </span>
        </div>
      </div>
      {!notification.read && (
        <span className="absolute top-4 right-4 size-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </div>
  );

  return notification.href ? (
    <Link key={notification.id} href={notification.href}>
      {content}
    </Link>
  ) : (
    <div key={notification.id}>{content}</div>
  );
}

export default async function PortalNotificationsPage() {
  const session = await auth();
  const patientId = session?.user.patientId;
  const now = new Date();

  if (patientId) {
    await ensurePrescriptionRenewalNotifications(patientId);
  }

  const notifications = patientId
    ? await prisma.notification.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const unreadCount = notifications.filter((n) => !n.read).length;
  const byCategory = (category: NotificationCategory) =>
    notifications.filter((n) => n.category === category);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{unreadCount} unread</span> notifications
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="link" className="h-auto p-0">
              Mark all read
            </Button>
          </form>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="all" className={PILL_TAB_TRIGGER}>
            All
            {unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="APPOINTMENT" className={PILL_TAB_TRIGGER}>
            Appointments
          </TabsTrigger>
          <TabsTrigger value="LAB_RESULT" className={PILL_TAB_TRIGGER}>
            Lab Results
          </TabsTrigger>
          <TabsTrigger value="PRESCRIPTION" className={PILL_TAB_TRIGGER}>
            Prescriptions
          </TabsTrigger>
          <TabsTrigger value="DIAGNOSIS" className={PILL_TAB_TRIGGER}>
            Diagnoses
          </TabsTrigger>
          <TabsTrigger value="ANNOUNCEMENT" className={PILL_TAB_TRIGGER}>
            Announcements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 grid gap-3">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} message="No notifications right now." />
          ) : (
            notifications.map((n) => <NotificationCard key={n.id} notification={n} now={now} />)
          )}
        </TabsContent>

        {(["APPOINTMENT", "LAB_RESULT", "PRESCRIPTION", "DIAGNOSIS", "ANNOUNCEMENT"] as const).map((category) => (
          <TabsContent key={category} value={category} className="mt-4 grid gap-3">
            {byCategory(category).length === 0 ? (
              <EmptyState icon={CATEGORY_META[category].icon} message="Nothing here yet." />
            ) : (
              byCategory(category).map((n) => (
                <NotificationCard key={n.id} notification={n} now={now} />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
