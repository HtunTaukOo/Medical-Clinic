"use client";

import { useTransition, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NotificationTone } from "@prisma/client";

const TONE_ICON_CLASS: Record<NotificationTone, string> = {
  INFO: "bg-blue-100 text-blue-600",
  SUCCESS: "bg-emerald-100 text-emerald-600",
  WARNING: "bg-amber-100 text-amber-600",
};

export function formatRelativeTime(date: Date, now: Date) {
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

export function NotificationCard({
  notification,
  now,
  meta,
  markRead,
}: {
  notification: {
    id: string;
    tone: NotificationTone;
    title: string;
    body: string;
    href: string | null;
    read: boolean;
    createdAt: Date;
  };
  now: Date;
  meta: { label: string; icon: ReactNode; badgeClass: string };
  markRead: (id: string) => Promise<void>;
}) {
  const [, startTransition] = useTransition();
  const icon = notification.tone === "SUCCESS" ? <CheckCircle2 className="size-4" /> : meta.icon;

  const handleClick = () => {
    if (!notification.read) startTransition(() => markRead(notification.id));
  };

  const content = (
    <div
      className={`relative flex items-start gap-3 rounded-xl border p-4 transition-colors ${
        notification.read ? "border-border bg-white" : "border-blue-100 bg-blue-50/60 hover:bg-blue-50"
      }`}
    >
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_CLASS[notification.tone]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium">{notification.title}</p>
        <p className="text-sm text-muted-foreground">{notification.body}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge className={meta.badgeClass}>{meta.label}</Badge>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt, now)}</span>
        </div>
      </div>
      {!notification.read && (
        <span className="absolute top-4 right-4 size-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </div>
  );

  return notification.href ? (
    <Link href={notification.href} onClick={handleClick}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={handleClick} className="block w-full text-left">
      {content}
    </button>
  );
}
