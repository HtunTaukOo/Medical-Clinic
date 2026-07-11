import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HeroBanner({
  name,
  subtitle,
  icon: Icon,
  actions,
}: {
  name: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/85 p-8 text-primary-foreground shadow-sm">
      <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute top-6 -right-28 size-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-20 -bottom-12 size-32 rounded-full bg-white/5" />
      {Icon && (
        <Icon
          strokeWidth={1.5}
          className="pointer-events-none absolute top-6 right-8 size-16 text-primary-foreground/15 sm:size-20"
        />
      )}
      <div className="relative grid gap-4">
        <div>
          <p className="text-sm text-primary-foreground/70">{dateLabel}</p>
          <h1 className="mt-1 text-3xl font-bold">
            {greeting}
            {name ? `, ${name}` : ""}
          </h1>
          {subtitle && (
            <p className="mt-1 text-primary-foreground/90">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}
